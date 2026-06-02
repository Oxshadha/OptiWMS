import streamlit as st
import plotly.express as px
from agent import load_agent, ask
from db_agent import ask_database

st.set_page_config(page_title="OptiWMS Assistant", page_icon="🏭", layout="wide")
st.title("🏭 OptiWMS Warehouse Assistant")

tab1, tab2 = st.tabs(["📄 SOP Assistant", "📊 Data & Analytics"])

# ── Tab 1: SOP Q&A (your existing agent) ──────────────────────────────────
with tab1:
    st.caption("Ask me anything about warehouse SOPs and procedures.")

    @st.cache_resource
    def get_sop_agent():
        return load_agent()

    chain = get_sop_agent()

    if "sop_messages" not in st.session_state:
        st.session_state.sop_messages = []

    for msg in st.session_state.sop_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg.get("sources"):
                st.caption("Sources: " + ", ".join(msg["sources"]))

    if question := st.chat_input("Ask about warehouse procedures...", key="sop_input"):
        st.session_state.sop_messages.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.markdown(question)
        with st.chat_message("assistant"):
            with st.spinner("Checking SOPs..."):
                answer, sources = ask(chain, question)
            st.markdown(answer)
            if sources:
                st.caption("Sources: " + ", ".join(sources))
        st.session_state.sop_messages.append({
            "role": "assistant", "content": answer, "sources": sources
        })

# ── Tab 2: Data & Analytics ───────────────────────────────────────────────
with tab2:
    st.caption("Ask questions about your WMS data. Charts are generated automatically.")

    if "db_messages" not in st.session_state:
        st.session_state.db_messages = []

    # Show example questions
    st.markdown("**Example questions:**")
    col1, col2, col3 = st.columns(3)
    examples = [
        "Show me stock levels for all products",
        "Sales history of SKU-001 last 3 months",
        "Top 10 products by movement frequency",
        "Inventory by warehouse zone",
        "Orders received this week by status",
        "Products with stock below reorder level",
    ]
    for i, example in enumerate(examples):
        col = [col1, col2, col3][i % 3]
        if col.button(example, key=f"ex_{i}"):
            st.session_state.pending_question = example

    st.divider()

    # Show chat history
    for msg in st.session_state.db_messages:
        with st.chat_message(msg["role"]):
            if msg["role"] == "assistant":
                if msg.get("sql"):
                    with st.expander("View generated SQL"):
                        st.code(msg["sql"], language="sql")
                if msg.get("df") is not None:
                    df = msg["df"]
                    st.dataframe(df, use_container_width=True)
                    # Auto-pick chart type
                    if len(df.columns) >= 2 and len(df) > 1:
                        num_cols = df.select_dtypes(include="number").columns.tolist()
                        cat_cols = df.select_dtypes(exclude="number").columns.tolist()
                        if num_cols and cat_cols:
                            if len(df) <= 20:
                                fig = px.bar(df, x=cat_cols[0], y=num_cols[0],
                                             title=msg.get("question", ""))
                            else:
                                fig = px.line(df, x=df.columns[0], y=num_cols[0],
                                              title=msg.get("question", ""))
                            st.plotly_chart(fig, use_container_width=True)
                if msg.get("error"):
                    st.error(msg["error"])
            else:
                st.markdown(msg["content"])

    # Handle example button click
    pending = st.session_state.pop("pending_question", None)

    if question := (st.chat_input("Ask about your WMS data...", key="db_input") or pending):
        st.session_state.db_messages.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.markdown(question)

        with st.chat_message("assistant"):
            with st.spinner("Generating SQL and fetching data..."):
                df, sql, error = ask_database(question)

            result = {"role": "assistant", "sql": sql, "df": df,
                      "error": error, "question": question}

            if sql:
                with st.expander("View generated SQL"):
                    st.code(sql, language="sql")
            if df is not None:
                st.dataframe(df, use_container_width=True)
                num_cols = df.select_dtypes(include="number").columns.tolist()
                cat_cols = df.select_dtypes(exclude="number").columns.tolist()
                if len(df) > 1 and num_cols and cat_cols:
                    if len(df) <= 20:
                        fig = px.bar(df, x=cat_cols[0], y=num_cols[0], title=question)
                    else:
                        fig = px.line(df, x=df.columns[0], y=num_cols[0], title=question)
                    st.plotly_chart(fig, use_container_width=True)
            if error:
                st.error(error)

            st.session_state.db_messages.append(result)
        st.rerun()