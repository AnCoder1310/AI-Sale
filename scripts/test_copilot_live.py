import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.config import get_settings
from src.services.llm import get_llm
from src.knowledge.index_readiness import check_copilot_index

def run_diagnostics():
    settings = get_settings()
    print("=" * 60)
    print("       COPILOT LIVE DIAGNOSTIC TOOL       ")
    print("=" * 60)
    print("1. ENVIRONMENT CHECK:")
    print(f"   - App Env: {settings.app_env}")
    print(f"   - LLM Provider: {settings.llm_provider}")
    print(f"   - Model: {settings.model_name}")
    print(f"   - OpenRouter Key prefix: {settings.openrouter_api_key[:12] if settings.openrouter_api_key else 'MISSING'}")
    print(f"   - Sales PII Key prefix: {settings.sales_pii_key.get_secret_value()[:8] if settings.sales_pii_key else 'MISSING'}")
    print(f"   - Vector Backend: {settings.vector_store_type}")
    print(f"   - Vector Collection: {settings.chroma_collection_name}")
    print()

    print("2. KNOWLEDGE BASE (RAG) CHECK:")
    try:
        snapshot = check_copilot_index()
        print(f"   ✓ Index is READY! Total chunks: {len(snapshot.chunks)}")
    except Exception as e:
        print(f"   ✗ Index error: {e}")
    print()

    print("3. LLM CONNECTIVITY & COMPLETION TEST:")
    try:
        llm = get_llm(max_tokens=50)
        from langchain_core.messages import HumanMessage
        print("   Sending test prompt to OpenRouter...")
        res = llm.invoke([HumanMessage(content="Hello, answer 'OK' if you can read this.")])
        print(f"   ✓ LLM Response Success: {res.content.strip()[:100]}")
    except Exception as e:
        print(f"   ✗ LLM Call Failed: {type(e).__name__} -> {e}")
    print()

    print("4. FULL COPILOT QUERY TEST:")
    try:
        from src.agents.copilot.graph import copilot_agent
        from src.agents.copilot.runtime import RuntimeBudget
        print("   Running test query: 'Quãng đường di chuyển của VF 5'...")
        runtime = RuntimeBudget.create(settings)
        state = asyncio.run(copilot_agent.ainvoke({"query": "Quãng đường di chuyển của VF 5", "runtime": runtime}))
        final = state.get("final_response")
        if final:
            print(f"   ✓ Status: {final.status}")
            print(f"   ✓ Answer: {final.answer[:150]}...")
            print(f"   ✓ Citations: {len(final.citations)}")
        else:
            print(f"   ✗ No final response returned in state: {state.keys()}")
    except Exception as e:
        cause = getattr(e, "__cause__", None) or e
        print(f"   ✗ Full Query Failed: {type(e).__name__} (cause: {type(cause).__name__}) -> {cause}")
    print("=" * 60)

if __name__ == "__main__":
    run_diagnostics()
