import streamlit as st
from agent import load_agent, ask

st.set_page_config(
    page_title="OptiWMS Assistant",
    page_icon="🏭",
    layout="centered"
)

st.title("🏭 OptiWMS Warehouse Assistant")
st.caption("Ask me anything about warehouse SOPs and operations.")

@st.cache_resource
def get_agent():
    return load_agent()

chain = get_agent()

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("sources"):
            st.caption("Sources: " + ", ".join(msg["sources"]))

if question := st.chat_input("Ask about warehouse procedures..."):
    st.session_state.messages.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)

    with st.chat_message("assistant"):
        with st.spinner("Checking SOPs..."):
            answer, sources = ask(chain, question)
        st.markdown(answer)
        if sources:
            st.caption("Sources: " + ", ".join(sources))

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer,
        "sources": sources
    })