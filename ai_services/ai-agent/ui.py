"""Optional Streamlit shell for the SOP-only assistant.

Live warehouse facts are intentionally not queried here. They are exposed by
the authenticated Spring tool API documented in docs/openapi.
"""

import streamlit as st

from agent import ask, load_agent

st.set_page_config(page_title="OptiWMS SOP Assistant", page_icon="🏭", layout="centered")
st.title("🏭 OptiWMS SOP Assistant")
st.caption("Source-grounded warehouse procedures. Operational facts use authenticated Spring business tools.")

@st.cache_resource
def get_sop_agent():
    return load_agent()

chain = get_sop_agent()
if "sop_messages" not in st.session_state:
    st.session_state.sop_messages = []

for message in st.session_state.sop_messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message.get("sources"):
            st.caption("Sources: " + ", ".join(message["sources"]))

if question := st.chat_input("Ask about warehouse procedures..."):
    st.session_state.sop_messages.append({"role": "user", "content": question})
    with st.chat_message("assistant"):
        with st.spinner("Checking SOPs..."):
            answer, sources = ask(chain, question)
        st.markdown(answer)
        if sources:
            st.caption("Sources: " + ", ".join(sources))
    st.session_state.sop_messages.append({"role": "assistant", "content": answer, "sources": sources})
