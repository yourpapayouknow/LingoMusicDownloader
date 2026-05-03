import streamlit as st
import time
import os
import pandas as pd
from utils.api import submit_download, get_status

st.set_page_config(
    page_title="LingoMusic",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Load CSS
def load_css():
    css_path = os.path.join(os.path.dirname(__file__), "assets", "styles.css")
    if os.path.exists(css_path):
        with open(css_path, "r") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

load_css()

# Header
st.title("LingoMusic Downloader 🎧")
st.markdown("Enter an Apple Music link below (Song, Album, Playlist) to download it locally in high quality.")

# Input Section
col1, col2 = st.columns([4, 1])
with col1:
    url_input = st.text_input("Apple Music URL", placeholder="https://music.apple.com/...", label_visibility="collapsed")
with col2:
    if st.button("Download", use_container_width=True):
        if url_input:
            with st.spinner("Submitting..."):
                success, msg = submit_download(url_input)
                if success:
                    st.toast(msg, icon="✅")
                else:
                    st.error(msg)
        else:
            st.warning("Please enter a valid URL.")

st.markdown("---")
st.subheader("Live Download Status")

# Auto-refreshing status area
status_placeholder = st.empty()

# Polling Loop
def render_status():
    success, data = get_status()
    if not success:
        status_placeholder.error(f"Backend Status: Offline 🔴 - {data.get('error', 'Unknown')}")
        return

    is_init = data.get("is_initialized", False)
    downloads = data.get("downloads", {})

    if not is_init:
        status_placeholder.warning("⚠️ Backend is online, but Gamdl is not initialized. Please ensure cookies.txt is valid.")
        return

    if not downloads:
        status_placeholder.info("No active downloads in queue.")
        return

    # Render Active Downloads
    with status_placeholder.container():
        for url, info in downloads.items():
            status = info.get("status", "unknown")
            items = info.get("items", [])
            
            with st.expander(f"📦 {url.split('?')[0].split('/')[-1] or 'Item'} - Status: {status.title()}", expanded=True):
                if items:
                    # Convert to dataframe for clean table rendering
                    df_data = []
                    for idx, item in enumerate(items):
                        df_data.append({
                            "Track": f"#{idx+1}",
                            "Status": item.get("status", "pending").title()
                        })
                    st.table(pd.DataFrame(df_data))
                else:
                    st.text("Fetching metadata...")

# Since Streamlit re-runs top to bottom, to get a live updating effect without blocking the UI completely,
# we use an auto-refresh trick using time.sleep and st.rerun if there are active downloads.
render_status()

success, data = get_status()
if success and data.get("is_initialized", False):
    downloads = data.get("downloads", {})
    # Check if any download is actively processing or downloading
    active = any(d.get("status") in ["pending", "processing", "downloading"] for d in downloads.values())
    
    # If active, trigger rerun after 2 seconds
    if active:
        time.sleep(2)
        st.rerun()

