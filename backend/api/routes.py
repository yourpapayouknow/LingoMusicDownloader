# 后端业务API总路由聚合模块
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