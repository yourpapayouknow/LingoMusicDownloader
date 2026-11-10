# 后端FastAPI主应用入口与中间件配置模块
from backend.head import FastAPI, CORSMiddleware, uvicorn, logging, sys
from backend.core.config import settings
from backend.api.routes import router as api_router

# 统一重定向Windows标准控制台输出编码
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 全局日志与服务实例
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper()))
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# 注册跨域资源共享中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载业务API路由组
app.include_router(api_router, prefix="/api")


# 记录服务就绪日志（下载引擎改为首个业务请求时懒初始化）
@app.on_event("startup")
async def strtpevt():
    logger.info("Backend ready. Downloader engine will initialize on first request.")


# 读取API服务根路径欢迎信息端点
@app.get("/")
def rdrwt():
    return {"message": "Welcome to LingoMusicDownloader API"}


# 兼容性别名
read_root = rdrwt
startup_event = strtpevt


# 独立启动执行入口
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000)
