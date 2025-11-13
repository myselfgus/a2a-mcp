"""
A2A Client Example - Test the multi-workflow server

This script demonstrates how to communicate with the A2A multi-workflow server
using JSON-RPC protocol.

The server must be running on http://localhost:9999
"""

import asyncio
import json
from typing import Any

import aiohttp


class A2AClient:
    """Simple A2A JSON-RPC client."""

    def __init__(self, url: str = "http://localhost:9999", timeout: int = 30):
        self.url = url
        self.timeout = timeout
        self.request_id = 1

    async def call(
        self,
        method: str,
        params: dict[str, Any] | None = None,
        workflow: str = "router_workflow",
    ) -> dict[str, Any]:
        """Call an A2A method via JSON-RPC."""
        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {},
        }
        self.request_id += 1

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    self.url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                ) as resp:
                    return await resp.json()
            except asyncio.TimeoutError:
                return {"error": f"Request timeout after {self.timeout}s"}
            except Exception as e:
                return {"error": str(e)}

    async def send_message(
        self, message: str, workflow: str = "router_workflow"
    ) -> str:
        """Send a message to a specific workflow."""
        full_message = f"workflow:{workflow}|{message}"

        result = await self.call(
            "execute",
            {"message": full_message},
        )

        if "error" in result:
            return f"Error: {result['error']}"

        return result.get("result", "No response")


async def main():
    """Test the A2A server with different workflows."""
    client = A2AClient()

    print("=" * 70)
    print("🤖 A2A Multi-Workflow Server Client")
    print("=" * 70)

    # Test different workflows
    test_cases = [
        {
            "workflow": "router_workflow",
            "message": "What are the top 5 programming languages in 2024?",
            "description": "🔀 ROUTER: Smart routing to best agent",
        },
        {
            "workflow": "chaining_workflow",
            "message": "https://fast-agent.ai",
            "description": "⛓️  CHAINING: Fetch → Summarize → Create social post",
        },
        {
            "workflow": "parallel_workflow",
            "message": "The quick brown fox jumps over the lazy dog.",
            "description": "🔀 PARALLEL: Parallel processing (proofread, fact-check, style)",
        },
        {
            "workflow": "orchestrator_workflow",
            "message": "Write a 100-word article about AI and save it to /tmp/article.txt",
            "description": "📋 ORCHESTRATOR: Plan → Execute → Review iteratively",
        },
        {
            "workflow": "evaluator_optimizer_workflow",
            "message": "Write a compelling mission statement for an AI startup",
            "description": "🔄 EVALUATOR-OPTIMIZER: Generate → Evaluate → Refine",
        },
    ]

    for i, test in enumerate(test_cases, 1):
        print(f"\n{test['description']}")
        print(f"Message: {test['message']}")
        print("-" * 70)

        response = await client.send_message(test["message"], test["workflow"])
        print(f"Response: {response[:200]}...")  # Truncate for readability
        print()

        # Add delay between requests
        await asyncio.sleep(1)

    print("=" * 70)
    print("✅ Test complete!")
    print("=" * 70)


async def interactive():
    """Interactive mode - send messages to chosen workflow."""
    client = A2AClient()

    workflows = [
        "router_workflow",
        "chaining_workflow",
        "parallel_workflow",
        "orchestrator_workflow",
        "evaluator_optimizer_workflow",
        "human_input_workflow",
    ]

    print("\n" + "=" * 70)
    print("📌 Available Workflows:")
    for i, wf in enumerate(workflows, 1):
        print(f"  {i}. {wf}")
    print("=" * 70)

    choice = input("\nSelect workflow (1-6, default 1): ").strip() or "1"
    try:
        workflow = workflows[int(choice) - 1]
    except (ValueError, IndexError):
        workflow = "router_workflow"

    print(f"\n✅ Using: {workflow}")
    print("Type 'quit' to exit\n")

    while True:
        message = input("You: ").strip()
        if message.lower() in ("quit", "exit"):
            break

        if not message:
            continue

        print("Agent is thinking...")
        response = await client.send_message(message, workflow)
        print(f"\nAgent: {response}\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        asyncio.run(interactive())
    else:
        asyncio.run(main())
