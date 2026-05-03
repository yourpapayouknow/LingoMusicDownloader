import flet as ft
import asyncio
import os
from utils.api import submit_download, get_status, search_apple_music

def main(page: ft.Page):
    page.title = "LingoMusic Downloader"
    page.theme_mode = "dark"
    page.padding = 20
    page.window.width = 1000
    page.window.height = 800

    # UI Elements State
    search_results_container = ft.Column(scroll="auto", expand=True)
    status_container = ft.Column(scroll="auto", expand=True)
    
    codec_dropdown = ft.Dropdown(
        label="Audio Codec",
        options=[
            ft.dropdown.Option("aac-legacy", "AAC (Standard)"),
            ft.dropdown.Option("atmos", "Dolby Atmos (Requires Wrapper)"),
            ft.dropdown.Option("alac", "ALAC Lossless (Requires Wrapper)"),
        ],
        value="aac-legacy",
        width=250
    )
    
    resolution_dropdown = ft.Dropdown(
        label="MV Resolution",
        options=[
            ft.dropdown.Option("1080p"),
            ft.dropdown.Option("4k"),
        ],
        value="1080p",
        width=150
    )
    
    use_wrapper_checkbox = ft.Checkbox(label="Use Wrapper (For ALAC/Atmos)", value=False)

    def on_download_click(url, e):
        codec = codec_dropdown.value
        res = resolution_dropdown.value
        use_wrapper = use_wrapper_checkbox.value
        
        success, msg = submit_download(url, codec=codec, video_resolution=res, use_wrapper=use_wrapper)
        if success:
            page.snack_bar = ft.SnackBar(ft.Text("Download started!"), bgcolor="green")
            page.snack_bar.open = True
        else:
            page.snack_bar = ft.SnackBar(ft.Text(f"Failed: {msg}"), bgcolor="red")
            page.snack_bar.open = True
        page.update()

    def build_result_card(item_type, item):
        attrs = item.get("attributes", {})
        title = attrs.get("name", "Unknown Title")
        artist = attrs.get("artistName", "Unknown Artist")
        url = attrs.get("url", "")
        
        artwork = attrs.get("artwork", {})
        img_url = artwork.get("url", "").replace("{w}", "100").replace("{h}", "100")
        if not img_url:
            img_url = "https://via.placeholder.com/100"

        return ft.Card(
            content=ft.Container(
                padding=10,
                content=ft.Row([
                    ft.Image(src=img_url, width=60, height=60, border_radius=8),
                    ft.Column([
                        ft.Text(title, weight="bold", size=16),
                        ft.Text(f"{artist} • {item_type}", size=12, color="grey400"),
                    ], expand=True),
                    ft.ElevatedButton("Download", on_click=lambda e: on_download_click(url, e))
                ])
            )
        )

    def perform_search(e):
        term = search_input.value
        if not term:
            return
            
        search_results_container.controls.clear()
        search_results_container.controls.append(ft.ProgressRing())
        page.update()
        
        success, data = search_apple_music(term)
        search_results_container.controls.clear()
        
        if not success:
            search_results_container.controls.append(ft.Text(f"Search Failed: {data}", color="red"))
            page.update()
            return
            
        # Parse gamdl API search results (format can be tricky)
        results = data.get("results", {})
        has_results = False
        
        for category, cat_data in results.items():
            items = cat_data.get("data", [])
            for item in items:
                has_results = True
                search_results_container.controls.append(build_result_card(category, item))
                
        if not has_results:
            search_results_container.controls.append(ft.Text("No results found."))
            
        page.update()

    search_input = ft.TextField(
        hint_text="Search for songs, albums, or music videos (e.g., Justin Bieber Baby)", 
        expand=True,
        on_submit=perform_search
    )
    search_button = ft.ElevatedButton(
        content=ft.Text("🔍"),
        on_click=perform_search
    )
    
    # Status Polling Task
    async def poll_status():
        while True:
            success, data = await asyncio.to_thread(get_status)
            status_container.controls.clear()
            
            if not success:
                status_container.controls.append(ft.Text("Backend Offline", color="red"))
            else:
                downloads = data.get("downloads", {})
                if not downloads:
                    status_container.controls.append(ft.Text("No active downloads."))
                else:
                    for url, info in downloads.items():
                        status = info.get("status", "unknown")
                        items = info.get("items", [])
                        
                        dl_card = ft.Card(
                            content=ft.Container(
                                padding=10,
                                content=ft.Column([
                                    ft.Text(f"Task: {url.split('?')[0].split('/')[-1]}", weight="bold"),
                                    ft.Text(f"Status: {status.title()}"),
                                    ft.ProgressBar(value=1.0 if status == 'completed' else None) if status in ['downloading', 'processing'] else ft.Container()
                                ])
                            )
                        )
                        status_container.controls.append(dl_card)
                        
            page.update()
            await asyncio.sleep(2)

    # Layout
    header = ft.Row([
        ft.Text("🎵", size=30, color="blue400"),
        ft.Text("LingoMusic Downloader", size=24, weight="bold")
    ])
    
    settings_row = ft.Row([codec_dropdown, resolution_dropdown, use_wrapper_checkbox])
    search_row = ft.Row([search_input, search_button])
    
    main_layout = ft.Row([
        # Left Panel (Search)
        ft.Column([
            ft.Text("Search & Settings", size=18, weight="bold"),
            settings_row,
            search_row,
            ft.Divider(),
            search_results_container
        ], expand=2),
        
        ft.VerticalDivider(),
        
        # Right Panel (Status)
        ft.Column([
            ft.Text("Download Queue", size=18, weight="bold"),
            ft.Divider(),
            status_container
        ], expand=1)
    ], expand=True)

    # Cookie Check Logic
    COOKIE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cookies.txt")
    
    def on_save_cookies(e):
        if not cookie_input.value:
            return
        try:
            with open(COOKIE_PATH, "w", encoding="utf-8") as f:
                f.write(cookie_input.value.strip())
            cookie_dialog.open = False
            page.snack_bar = ft.SnackBar(ft.Text("Cookies saved successfully!"), bgcolor="green")
            page.snack_bar.open = True
            page.update()
            # Start polling now that we have cookies
            page.run_task(poll_status)
        except Exception as ex:
            page.snack_bar = ft.SnackBar(ft.Text(f"Error saving cookies: {ex}"), bgcolor="red")
            page.snack_bar.open = True
            page.update()

    cookie_input = ft.TextField(
        label="Cookie Content",
        multiline=True,
        min_lines=5,
        max_lines=15,
        hint_text="# Netscape HTTP Cookie File..."
    )
    
    cookie_dialog = ft.AlertDialog(
        modal=True,
        title=ft.Text("Cookies Required"),
        content=ft.Column([
            ft.Text("Apple Music cookies are missing or invalid."),
            ft.Text("Instructions:", weight="bold"),
            ft.Text("1. Log in to music.apple.com in your browser."),
            ft.Text("2. Use a cookie export extension (e.g., 'Cookie-Editor')."),
            ft.Text("3. Export as 'Netscape' format and paste below."),
            cookie_input
        ], tight=True, width=500),
        actions=[
            ft.ElevatedButton("Save & Continue", on_click=on_save_cookies)
        ]
    )

    page.add(header, ft.Divider(), main_layout)
    
    # Check if cookies exist
    if not os.path.exists(COOKIE_PATH) or os.path.getsize(COOKIE_PATH) < 10:
        page.dialog = cookie_dialog
        cookie_dialog.open = True
        page.update()
    else:
        # Start polling immediately if cookies are present
        page.run_task(poll_status)

if __name__ == "__main__":
    ft.app(main)
