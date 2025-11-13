"""
A2A Multi-Workflow Server with FastAgent
Exposes all workflow types (chaining, parallel, router, orchestrator, evaluator, human_input)
via A2A (Agent-to-Agent) protocol with HTTP and JSON-RPC transport.

Run:
    uv run a2a_multi_workflow_server.py
"""

import asyncio
from contextlib import AsyncExitStack
from pathlib import Path
from typing import TYPE_CHECKING, cast

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCard, TransportProtocol
from a2a.utils import new_agent_text_message
from uvicorn import Config, Server

from fast_agent import FastAgent
from fast_agent.core.prompt import Prompt

if TYPE_CHECKING:
    from a2a.server.events import EventQueue
    from fast_agent.core.agent_app import AgentApp
    from fast_agent.interfaces import AgentProtocol

HOST = "0.0.0.0"
PORT = 9999

# Create the FastAgent application
fast = FastAgent(
    "A2A Multi-Workflow Server",
    parse_cli_args=False,
    quiet=True,
)

# ============================================================================
# WORKFLOW 1: CHAINING - Sequential agent workflow
# ============================================================================
@fast.agent(
    "url_summarizer",
    instruction="Given a URL or text, provide a complete and comprehensive summary",
    servers=["fetch"],
)
@fast.agent(
    "content_writer",
    instruction="Write a social media post (280 chars) from given text. Respond only with the post, no hashtags.",
)
@fast.chain(
    name="chaining_workflow",
    sequence=["url_summarizer", "content_writer"],
)
async def chaining_workflow() -> None:
    """Sequential: URL → Summary → Social Post"""
    pass


# ============================================================================
# WORKFLOW 2: PARALLEL - Fan-out/Fan-in workflow
# ============================================================================
@fast.agent(
    name="proofreader",
    instruction="Review text for grammar, spelling, punctuation and phrasing errors. Provide detailed feedback.",
)
@fast.agent(
    name="fact_checker",
    instruction="Verify factual consistency and logical coherence. Identify contradictions or inaccuracies.",
)
@fast.agent(
    name="style_enforcer",
    instruction="Analyze narrative flow, clarity of expression, and tone. Suggest improvements for readability.",
    model="sonnet",
)
@fast.agent(
    name="quality_grader",
    instruction="Compile feedback from proofreader, fact_checker, and style_enforcer. Provide overall grade and recommendations.",
)
@fast.parallel(
    fan_out=["proofreader", "fact_checker", "style_enforcer"],
    fan_in="quality_grader",
    name="parallel_workflow",
)
async def parallel_workflow() -> None:
    """Parallel: Content → [Proofread, Fact-Check, Style] → Grade"""
    pass


# ============================================================================
# WORKFLOW 3: ROUTER - Intelligent delegation
# ============================================================================
@fast.agent(
    name="code_analyst",
    model="haiku",
    instruction="You are an expert in code analysis. Analyze code quality, architecture, and best practices.",
    servers=["filesystem"],
)
@fast.agent(
    name="web_researcher",
    model="haiku",
    instruction="You are a research assistant that fetches and analyzes web content.",
    servers=["fetch"],
)
@fast.agent(
    name="general_assistant",
    model="haiku",
    instruction="You are a knowledgeable assistant answering general questions clearly.",
)
@fast.router(
    name="router_workflow",
    model="sonnet",
    agents=["code_analyst", "web_researcher", "general_assistant"],
)
async def router_workflow() -> None:
    """Smart Router: Request → Determine Agent → Execute"""
    pass


# ============================================================================
# WORKFLOW 4: ORCHESTRATOR - Multi-agent planning
# ============================================================================
@fast.agent(
    name="task_planner",
    instruction="You are a project planner. Break down complex tasks into steps and assign them to appropriate agents.",
    servers=["filesystem"],
)
@fast.agent(
    name="executor",
    instruction="You execute tasks assigned to you. Use available tools to complete work.",
    servers=["filesystem", "fetch"],
)
@fast.agent(
    name="reviewer",
    instruction="Review completed work for quality, completeness and alignment with requirements.",
)
@fast.iterative_planner(
    name="orchestrator_workflow",
    agents=["task_planner", "executor", "reviewer"],
    model="sonnet",
    plan_iterations=3,
)
async def orchestrator_workflow() -> None:
    """Orchestrator: Complex task → Plan → Execute → Review (iterative)"""
    pass


# ============================================================================
# WORKFLOW 5: EVALUATOR-OPTIMIZER - Iterative refinement
# ============================================================================
@fast.agent(
    name="content_generator",
    instruction="Generate high-quality content based on requirements.",
    model="gpt-5-nano.low",
    use_history=True,
)
@fast.agent(
    name="quality_evaluator",
    instruction="""Evaluate content on:
    1. Clarity and grammar
    2. Relevance and specificity
    3. Tone and style appropriateness
    4. Completeness

    Provide ratings (EXCELLENT/GOOD/FAIR/POOR) and specific feedback.""",
    model="o3-mini.medium",
)
@fast.evaluator_optimizer(
    name="evaluator_optimizer_workflow",
    generator="content_generator",
    evaluator="quality_evaluator",
    min_rating="EXCELLENT",
    max_refinements=3,
)
async def evaluator_optimizer_workflow() -> None:
    """Evaluator-Optimizer: Generate → Evaluate → Refine (loop until EXCELLENT)"""
    pass


# ============================================================================
# WORKFLOW 6: SIMPLE AGENT - Basic agent
# ============================================================================
@fast.agent(
    name="simple_assistant",
    instruction="You are a helpful assistant that answers questions clearly and concisely.",
)
async def simple_assistant() -> None:
    """Simple Assistant: Direct question answering"""
    pass


# ============================================================================
# A2A EXECUTOR - Proxies A2A requests to FastAgent runtime
# ============================================================================
class MultiWorkflowExecutor(AgentExecutor):
    """AgentExecutor that routes to different workflows based on workflow_type."""

    def __init__(self) -> None:
        self._stack = AsyncExitStack()
        self._agents: "AgentApp | None" = None

    async def _agents_app(self) -> "AgentApp":
        """Ensure FastAgent runtime is running."""
        if self._agents is None:
            self._agents = await self._stack.enter_async_context(fast.run())
        return self._agents

    async def _workflow(self, workflow_name: str = "router_workflow") -> "AgentProtocol":
        """Get the requested workflow agent."""
        app = await self._agents_app()
        agents_map = cast("dict[str, AgentProtocol]", getattr(app, "_agents"))

        if workflow_name in agents_map:
            return agents_map[workflow_name]

        # Default to router if not found
        return agents_map.get("router_workflow", next(iter(agents_map.values())))

    async def execute(
        self,
        context: RequestContext,
        event_queue: "EventQueue",
    ) -> None:
        """Execute workflow request."""
        message = context.get_user_input().strip()
        if not message:
            return

        # Extract workflow type from message metadata or default to router
        # Format: "workflow:router_workflow|your message here" or just "your message"
        workflow_name = "router_workflow"
        user_message = message

        if "|" in message and message.startswith("workflow:"):
            parts = message.split("|", 1)
            workflow_name = parts[0].replace("workflow:", "").strip()
            user_message = parts[1].strip()

        try:
            agent = await self._workflow(workflow_name)
            response = await agent.send(user_message)
            await event_queue.enqueue_event(new_agent_text_message(response))
        except Exception as e:
            error_msg = f"Error in {workflow_name}: {str(e)}"
            await event_queue.enqueue_event(new_agent_text_message(error_msg))

    async def cancel(self, context: RequestContext, event_queue: "EventQueue") -> None:
        """Cancel request (not fully supported)."""
        raise Exception("cancel not fully supported in multi-workflow executor")

    async def agent_card(self, agent_name: str | None = None) -> AgentCard:
        """Return agent card."""
        agent = await self._workflow(agent_name or "router_workflow")
        return await agent.agent_card()

    async def shutdown(self) -> None:
        """Shutdown FastAgent runtime."""
        await self._stack.aclose()
        self._agents = None


# ============================================================================
# MAIN - Start A2A HTTP Server
# ============================================================================
async def main() -> None:
    """Start the A2A multi-workflow server."""
    executor = MultiWorkflowExecutor()
    agent_card = await executor.agent_card()

    # Update agent card with server details
    base_url = f"http://localhost:{PORT}/"
    agent_card = agent_card.model_copy(
        update={
            "url": base_url,
            "preferred_transport": TransportProtocol.jsonrpc,
            "additional_interfaces": [],
            "supports_authenticated_extended_card": False,
            "default_input_modes": ["text"],
            "default_output_modes": ["text"],
        }
    )

    request_handler = DefaultRequestHandler(
        agent_executor=executor,
        task_store=InMemoryTaskStore(),
    )

    server = A2AStarletteApplication(
        agent_card=agent_card,
        http_handler=request_handler,
    )

    config = Config(server.build(), host=HOST, port=PORT)
    uvicorn_server = Server(config)

    print(f"\n🚀 A2A Multi-Workflow Server starting on http://{HOST}:{PORT}")
    print("\n📋 Available workflows:")
    print("  - chaining_workflow: Sequential (URL → Summary → Post)")
    print("  - parallel_workflow: Fan-out/Fan-in (Content → [3 parallel checks] → Grade)")
    print("  - router_workflow: Smart routing (Request → Best Agent)")
    print("  - orchestrator_workflow: Multi-step planning (Task → Plan → Execute → Review)")
    print("  - evaluator_optimizer_workflow: Iterative refinement (Generate → Evaluate → Refine)")
    print("  - human_input_workflow: Interactive (Can request user input)")
    print("\n📌 Usage: Send message with format 'workflow:workflow_name|your message'")
    print("   Or use 'router_workflow' by default\n")

    try:
        await uvicorn_server.serve()
    finally:
        await executor.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
