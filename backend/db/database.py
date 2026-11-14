# 本地SQLite数据库持久化管理模块
from backend.head import sqlite3, os, json, logging, contextmanager, List, Dict, Any, Optional
from backend.core.config import settings

# 数据库存储目录与文件路径
DB_DIR = os.path.join(settings.bsdir(), "data")
DB_PATH = os.path.join(DB_DIR, "lingo.db")

# 日志记录器
logger = logging.getLogger(__name__)


# 获取数据库连接（写操作成功后自动提交，异常时回滚）
@contextmanager
def dbcxn(write: bool = False):
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        if write:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# 初始化数据库表结构
def intdb() -> None:
    with dbcxn(write=True) as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS download_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id VARCHAR(64) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                artist_name VARCHAR(255),
                album_name VARCHAR(255),
                artwork_url TEXT,
                codec VARCHAR(32) NOT NULL,
                file_path TEXT,
                lyrics_path TEXT,
                file_size INTEGER,
                download_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("PRAGMA table_info(download_history)")
        history_columns = {row["name"] for row in cursor.fetchall()}
        if "lyrics_path" not in history_columns:
            cursor.execute("ALTER TABLE download_history ADD COLUMN lyrics_path TEXT")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_preferences (
                keyword VARCHAR(128) PRIMARY KEY,
                search_count INTEGER DEFAULT 1,
                download_count INTEGER DEFAULT 0,
                last_used DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS client_settings (
                config_key VARCHAR(64) PRIMARY KEY,
                config_value TEXT NOT NULL
            )
        """)


# 读取全部客户端配置项
def gtallstngs() -> Dict[str, Any]:
    with dbcxn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT config_key, config_value FROM client_settings")
        rows = cursor.fetchall()

    result = {}
    for row in rows:
        try:
            result[row["config_key"]] = json.loads(row["config_value"])
        except Exception as exc:
            logger.debug("Settings value is not JSON, using raw string for key %s: %s", row["config_key"], exc)
            result[row["config_key"]] = row["config_value"]
    return result


# 保存客户端配置字典
def svstngs(settings_dict: Dict[str, Any]) -> None:
    with dbcxn(write=True) as conn:
        cursor = conn.cursor()
        for key, value in settings_dict.items():
            val_str = json.dumps(value) if not isinstance(value, str) else value
            cursor.execute(
                "INSERT INTO client_settings (config_key, config_value) VALUES (?, ?) "
                "ON CONFLICT(config_key) DO UPDATE SET config_value=excluded.config_value",
                (key, val_str),
            )


# 插入或更新单条下载历史记录
def inshstry(data: Dict[str, Any]) -> None:
    with dbcxn(write=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO download_history
            (track_id, name, artist_name, album_name, artwork_url, codec, file_path, lyrics_path, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(track_id) DO UPDATE SET
                name=excluded.name,
                artist_name=excluded.artist_name,
                album_name=excluded.album_name,
                artwork_url=excluded.artwork_url,
                codec=excluded.codec,
                file_path=excluded.file_path,
                lyrics_path=excluded.lyrics_path,
                file_size=excluded.file_size,
                download_time=CURRENT_TIMESTAMP
            """,
            (
                str(data.get("track_id", "")),
                data.get("name", ""),
                data.get("artist_name", ""),
                data.get("album_name", ""),
                data.get("artwork_url", ""),
                data.get("codec", ""),
                data.get("file_path", ""),
                data.get("lyrics_path", ""),
                data.get("file_size", 0),
            ),
        )


# 查询全量下载历史记录列表
def gthstry() -> List[Dict[str, Any]]:
    with dbcxn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM download_history ORDER BY download_time DESC")
        rows = cursor.fetchall()
    return [dict(row) for row in rows]


# 根据track_id删除下载历史记录
def dlthstry(track_id: str) -> None:
    with dbcxn(write=True) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM download_history WHERE track_id = ?", (track_id,))


# 根据track_id查询单条历史记录
def gthstrybytrk(track_id: str) -> Optional[Dict[str, Any]]:
    with dbcxn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM download_history WHERE track_id = ?", (track_id,))
        row = cursor.fetchone()
    return dict(row) if row else None


# 更新单条下载记录的歌词路径
def updhstrylrc(track_id: str, lyrics_path: str) -> None:
    with dbcxn(write=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE download_history SET lyrics_path = ? WHERE track_id = ?",
            (lyrics_path or "", track_id),
        )


# 记录关键词搜索偏好频率
def rprtsrch(keyword: str) -> None:
    if not keyword or not keyword.strip():
        return
    with dbcxn(write=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO search_preferences (keyword, search_count, last_used)
            VALUES (?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(keyword) DO UPDATE SET
                search_count = search_count + 1,
                last_used = CURRENT_TIMESTAMP
            """,
            (keyword.strip(),),
        )


# 获取推荐关键词列表
def gtrecmdtn(limit: int = 10) -> List[str]:
    with dbcxn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT keyword
            FROM search_preferences
            ORDER BY (download_count * 3 + search_count) DESC, last_used DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()
    return [row["keyword"] for row in rows]