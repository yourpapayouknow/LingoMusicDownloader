# 后端业务API总路由聚合与跨模块适配器
from backend.head import APIRouter
from backend.api.routes_wsl import router as wsl_router
from backend.api.routes_wrapper import router as wrapper_router
from backend.api.routes_cookies import router as cookies_router
from backend.api.routes_search import router as search_router
from backend.api.routes_download import router as download_router
from backend.api.routes_settings import router as settings_router

# 核心全局路由器
router = APIRouter()

# 聚合业务子路由器
router.include_router(wsl_router)
router.include_router(wrapper_router)
router.include_router(cookies_router)
router.include_router(search_router)
router.include_router(download_router)
router.include_router(settings_router)

# 兼容性导入导出
from backend.api.common import (
    WRAPPER_DECRYPT_PORT,
    WRAPPER_M3U8_PORT,
    WRAPPER_ACCOUNT_PORT,
    nrmlcdclbl as _normalize_codec_label,
    wrprhlth as _get_wrapper_runtime_health,
)
from backend.api.routes_wsl import (
    dtctwsl as _detect_wsl2_installed,
    bldwslprchk as _build_wsl2_precheck,
)
from backend.api.routes_wrapper import (
    iswrprinst as _is_wrapper_installed,
    iswrprrun as _is_wrapper_running,
    stpwrprsrv as _stop_wrapper_service,
)
from backend.api.routes_cookies import (
    intmngrrtr as _initialize_manager_with_retry,
    exptaplcks as _export_apple_music_cookies_from_webview,
)
from backend.api.routes_search import (
    prsaplurl as parse_apple_music_url,
    nrmlsrchrst as _normalize_search_results,
    srchfast as _search_catalog_fast,
)
from backend.api.routes_download import (
    scnlcllb as _scan_local_library_impl,
)

__all__ = [
    "router",
    "WRAPPER_DECRYPT_PORT",
    "WRAPPER_M3U8_PORT",
    "WRAPPER_ACCOUNT_PORT",
    "_normalize_codec_label",
    "_get_wrapper_runtime_health",
    "_detect_wsl2_installed",
    "_build_wsl2_precheck",
    "_is_wrapper_installed",
    "_is_wrapper_running",
    "_stop_wrapper_service",
    "_initialize_manager_with_retry",
    "_export_apple_music_cookies_from_webview",
    "parse_apple_music_url",
    "_normalize_search_results",
    "_search_catalog_fast",
    "_scan_local_library_impl",
]
