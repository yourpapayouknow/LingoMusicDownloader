# 下载与转换目录存储位置管理服务
from backend.head import os, json, logging, Path, Dict, Any
from backend.core.config import settings

# 日志记录器
logger = logging.getLogger(__name__)


# 获取存储路径配置文件
def cfgpth() -> Path:
    return Path(settings.bsdir()) / "data" / "storage_paths.json"


# 校验并创建目录路径
def vlddir(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        raise ValueError("目录不能为空")
    path = Path(text).expanduser()
    if not path.is_absolute():
        raise ValueError("请使用绝对路径")
    try:
        resolved = path.resolve(strict=False)
    except OSError as exc:
        raise ValueError(f"目录路径无效: {exc}")
    if resolved.exists() and not resolved.is_dir():
        raise ValueError("目标路径不是文件夹")
    resolved.mkdir(parents=True, exist_ok=True)
    return str(resolved)


# 读取允许访问的目录集合（含当前、默认与历史配置）
def knownroots() -> list[str]:
    base = Path(settings.bsdir())
    roots = {
        str(Path(settings.outpth()).resolve()),
        str(Path(settings.cnvtpth()).resolve()),
        str((base / "Apple Music").resolve()),
        str((base / "Converted").resolve()),
    }
    try:
        payload = json.loads(cfgpth().read_text(encoding="utf-8"))
        for item in payload.get("known_dirs", []):
            value = str(item or "").strip()
            if value:
                roots.add(str(Path(value).expanduser().resolve()))
    except Exception:
        pass
    return sorted(roots)


# 读取当前存储路径
def gtpaths() -> Dict[str, Any]:
    base = Path(settings.bsdir())
    return {
        "success": True,
        "download_dir": settings.outpth(),
        "converted_dir": settings.cnvtpth(),
        "default_download_dir": str(base / "Apple Music"),
        "default_converted_dir": str(base / "Converted"),
    }


# 保存下载与转换目录
def svpaths(download_dir: str, converted_dir: str) -> Dict[str, Any]:
    dl_path = vlddir(download_dir)
    cv_path = vlddir(converted_dir)
    if os.path.normcase(dl_path) == os.path.normcase(cv_path):
        raise ValueError("下载目录与转换目录不能相同")
    if os.path.normcase(dl_path).startswith(os.path.normcase(cv_path) + os.sep) or \
       os.path.normcase(cv_path).startswith(os.path.normcase(dl_path) + os.sep):
        raise ValueError("下载目录与转换目录不能互相嵌套")

    known_dirs = set(knownroots())
    known_dirs.update({dl_path, cv_path})

    config_path = cfgpth()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = config_path.with_suffix(".tmp")
    tmp_path.write_text(
        json.dumps(
            {
                "download_dir": dl_path,
                "converted_dir": cv_path,
                "known_dirs": sorted(known_dirs),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    tmp_path.replace(config_path)
    return gtpaths()


# 恢复默认存储路径
def rstpaths() -> Dict[str, Any]:
    config_path = cfgpth()
    if config_path.exists():
        config_path.unlink()
    return gtpaths()