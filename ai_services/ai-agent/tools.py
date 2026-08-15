import os
import httpx
from langchain.tools import tool
from typing import Optional

SPRING_API_BASE_URL = os.getenv("SPRING_API_BASE_URL", "http://localhost:8080").rstrip("/")

def get_inventory_summary_tool(jwt_token: str):
    @tool
    def get_inventory_summary(warehouse_id: str) -> str:
        """
        Fetch current inventory metrics and stock levels for a specific warehouse.
        Use this tool when users ask about inventory, stock counts, or available space.
        """
        headers = {"Authorization": f"Bearer {jwt_token}"}
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"{SPRING_API_BASE_URL}/api/v1/inventory/summary?warehouseId={warehouse_id}", headers=headers)
                if resp.status_code == 200:
                    return resp.text
                elif resp.status_code == 403:
                    return "Access denied: You do not have permission to view inventory for this warehouse."
                return f"Error fetching inventory: {resp.status_code}"
        except Exception as e:
            return f"Network error contacting warehouse API: {str(e)}"
    return get_inventory_summary

@tool
def run_adhoc_readonly_query(question: str) -> str:
    """
    Execute a guarded read-only database query for complex analytics when no standard tool applies.
    Pass the user's natural language question to this tool.
    """
    from agent import ask_database
    try:
        df, sql, chart, error, answer, download_url = ask_database(question)
        if error:
            return f"Error: {error}"
        return answer
    except Exception as e:
        return f"Error executing query: {str(e)}"
