import flet as ft
import asyncio
from utils.api import submit_download, get_status, search_apple_music

def main(page: ft.Page):
    page.title = "LingoMusic Downloader"
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 20
    page.window_width = 1000
    page.window_height = 800

    # UI Elements State
    search_results_container = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
    status_container = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
    
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
            page.snack_bar = ft.SnackBar(ft.Text(f"Download started!"), bgcolor=ft.colors.GREEN)
        else:
            page.snack_bar = ft.SnackBar(ft.Text(f"Failed: {msg}"), bgcolor=ft.colors.RED)
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
                        ft.Text(title, weight=ft.FontWeight.BOLD, size=16),
                        ft.Text(f"{artist} • {item_type}", size=12, color=ft.colors.GREY_400),
                    ], expand=True),
                    ft.ElevatedButton("Download", icon=ft.icons.DOWNLOAD, on_click=lambda e: on_download_click(url, e))
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
            search_results_container.controls.append(ft.Text(f"Search Failed: {data}", color=ft.colors.RED))
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
    search_button = ft.IconButton(icon=ft.icons.SEARCH, on_click=perform_search)
    
    # Status Polling Task
    async def poll_status():
        while True:
            success, data = get_status()
            status_container.controls.clear()
            
            if not success:
                status_container.controls.append(ft.Text("Backend Offline", color=ft.colors.RED))
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
                                    ft.Text(f"Task: {url.split('?')[0].split('/')[-1]}", weight=ft.FontWeight.BOLD),
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
        ft.Icon(ft.icons.MUSIC_NOTE, size=30, color=ft.colors.BLUE_400),
        ft.Text("LingoMusic Downloader", size=24, weight=ft.FontWeight.BOLD)
    ])
    
    settings_row = ft.Row([codec_dropdown, resolution_dropdown, use_wrapper_checkbox])
    search_row = ft.Row([search_input, search_button])
    
    main_layout = ft.Row([
        # Left Panel (Search)
        ft.Column([
            ft.Text("Search & Settings", size=18, weight=ft.FontWeight.BOLD),
            settings_row,
            search_row,
            ft.Divider(),
            search_results_container
        ], expand=2),
        
        ft.VerticalDivider(),
        
        # Right Panel (Status)
        ft.Column([
            ft.Text("Download Queue", size=18, weight=ft.FontWeight.BOLD),
            ft.Divider(),
            status_container
        ], expand=1)
    ], expand=True)

    page.add(header, ft.Divider(), main_layout)
    
    # Start polling
    page.run_task(poll_status)

if __name__ == "__main__":
    ft.app(target=main)
