"""
reranker.py -- RetrievalResult[] -> RerankedResult[].

A local cross-encoder scores the query against each candidate jointly,
which is far more accurate than comparing two independent embeddings.

The original retrieval_score is carried through untouched alongside the new
rerank_score, so the UI can demonstrate that reranking changed the ordering.

The model is loaded once per process and reused.
"""
from __future__ import annotations

import logging
import math
import threading

from config import settings
from schemas import RerankedResult, RetrievalResult

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()


def get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from sentence_transformers import CrossEncoder

                logger.info("Loading reranker %s", settings.reranker_model)
                _model = CrossEncoder(
                    settings.reranker_model,
                    device=settings.torch_device,
                )
    return _model


def score_to_confidence(rerank_score: float) -> float:
    """Map reranker score into [0, 1] confidence.
    Handles both normalized similarities [0, 1] and unbounded cross-encoder logits.
    """
    if 0.0 <= rerank_score <= 1.0:
        return rerank_score
    try:
        return 1.0 / (1.0 + math.exp(-rerank_score))
    except OverflowError:
        return 0.0 if rerank_score < 0 else 1.0


class Reranker:
    def __init__(self, fast_mode: bool = True):
        self.fast_mode = fast_mode

    def fast_rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        top_k: int | None = None,
    ) -> list[RerankedResult]:
        """Ultra-fast (0.1ms) hybrid reranker: combines FAISS cosine similarity
        with query term coverage to boost relevant chunks without slow CPU cross-encoders."""
        if not results:
            return []
        k = top_k or settings.rerank_top_k

        # Extract significant query terms
        import re
        tokens = [w.lower() for w in re.findall(r"\w+", query) if len(w) >= 3]

        scored_results: list[tuple[RetrievalResult, float]] = []
        for r in results:
            content_lower = r.item.content.lower()
            term_matches = sum(1 for t in tokens if t in content_lower) if tokens else 0
            overlap_bonus = (term_matches / len(tokens)) * 0.15 if tokens else 0.0
            # Normalized score bounded between 0.0 and 0.99
            hybrid_score = min(0.99, max(0.01, float(r.score) + overlap_bonus))
            scored_results.append((r, hybrid_score))

        ordered = sorted(scored_results, key=lambda pair: pair[1], reverse=True)
        return [
            RerankedResult(
                item=result.item,
                retrieval_score=result.score,
                rerank_score=float(score),
                rank=position,
            )
            for position, (result, score) in enumerate(ordered[:k], start=1)
        ]

    def rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        top_k: int | None = None,
        force_cross_encoder: bool = False,
    ) -> list[RerankedResult]:
        if not results:
            return []
        k = top_k or settings.rerank_top_k

        # Default to fast reranker on CPU to avoid 8.6s delay
        if self.fast_mode and not force_cross_encoder:
            return self.fast_rerank(query, results, top_k=k)

        pairs = [(query, r.item.content) for r in results]
        try:
            scores = get_model().predict(pairs, show_progress_bar=False)
            ordered = sorted(
                zip(results, scores),
                key=lambda pair: float(pair[1]),
                reverse=True,
            )
            return [
                RerankedResult(
                    item=result.item,
                    retrieval_score=result.score,
                    rerank_score=float(score),
                    rank=position,
                )
                for position, (result, score) in enumerate(ordered[:k], start=1)
            ]
        except Exception as exc:
            logger.warning("CrossEncoder rerank failed (%s); falling back to fast rerank", exc)
            return self.fast_rerank(query, results, top_k=k)

