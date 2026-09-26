import os
import io
import sys
import pandas as pd
from pathlib import Path
from openai import OpenAI
from config import settings

def run_code_interpreter(query: str, csv_path: str) -> str:
    client = OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.online_base_url,
    )
    
    prompt = f"""You are a Python Data Analyst. 
The user wants to know: "{query}"
There is a CSV file loaded as a pandas DataFrame named `df`.
The path to the file is: {csv_path}
Write ONLY the python code to calculate the answer and print the final result.
Do NOT include markdown formatting like ```python, just the raw code.
Example:
import pandas as pd
df = pd.read_csv('{csv_path.replace(chr(92), '/')}')
print(df['fare'].mean())
"""
    
    try:
        response = client.chat.completions.create(
            model=settings.online_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.0
        )
        code = response.choices[0].message.content.strip()
        if code.startswith('```python'):
            code = code[9:]
        if code.startswith('```'):
            code = code[3:]
        if code.endswith('```'):
            code = code[:-3]
        code = code.strip()

        # Capture output
        old_stdout = sys.stdout
        sys.stdout = buffer = io.StringIO()
        try:
            # We provide a safe global context
            exec(code, {"pd": pd, "Path": Path, "os": os})
            output = buffer.getvalue().strip()
            if not output:
                output = "Code executed successfully but printed nothing."
            return f"Data Analysis Result:\n{output}"
        except Exception as e:
            return f"Error executing code:\n{e}"
        finally:
            sys.stdout = old_stdout
            
    except Exception as e:
        return f"Error connecting to LLM for code generation: {e}"
