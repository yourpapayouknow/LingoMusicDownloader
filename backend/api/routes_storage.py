# 下载与转换目录存储位置端点模块
from backend.head import APIRouter, HTTPException, BaseModel, Field, asyncio, logging
from backend.services.storage import gtpaths, svpaths, rstpaths

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()


# 存储路径请求模型
class StoragePathsRequest(BaseModel):
    download_dir: str = Field(min_length=1, max_length=4096)
    converted_dir: str = Field(min_length=1, max_length=4096)


# 获取当前存储路径端点
@router.get("/storage/paths")
async def gtdirrtr():
    return await asyncio.to_thread(gtpaths)


# 保存存储路径端点
@router.post("/storage/paths")
async def svdirrtr(request: StoragePathsRequest):
    try:
        return await asyncio.to_thread(svpaths, request.download_dir, request.converted_dir)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to save storage paths")
        raise HTTPException(status_code=500, detail=str(exc))


# 恢复默认存储路径端点
@router.post("/storage/paths/reset")
async def rstdirrtr():
    try:
        return await asyncio.to_thread(rstpaths)
    except Exception as exc:
        logger.exception("Failed to reset storage paths")
        raise HTTPException(status_code=500, detail=str(exc))