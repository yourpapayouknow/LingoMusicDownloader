# 本地SQLite数据库持久化管理模块
from backend.head import sqlite3, os, json, List, Dict, Any, Optional
from backend.core.config import settings

# 数据库存储目录与文件路径
DB_DIR = os.path.join(settings.bsdir(), "data")
if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)
DB_PATH = os.path.join(DB_DIR, "lingo.db")


# 获取数据库连接对象
def gtconn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# 初始化数据库表结构
def intdb() -> None:
    conn = gtconn()
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

    conn.commit()
    conn.close()


# 读取全部客户端配置项
def gtallstngs() -> Dict[str, Any]:
    conn = gtconn()
    cursor = conn.cursor()
    cursor.execute("SELECT config_key, config_value FROM client_settings")
    rows = cursor.fetchall()
    conn.close()

    result = {}
    for row in rows:
        try:
            result[row["config_key"]] = json.loads(row["config_value"])
        except Exception:
            result[row["config_key"]] = row["config_value"]
    return result


# 保存客户端配置字典
def svstngs(settings_dict: Dict[str, Any]) -> None:
    conn = gtconn()
    cursor = conn.cursor()
    for k, v in settings_dict.items():
        val_str = json.dumps(v) if not isinstance(v, str) else v
        cursor.execute(
            "INSERT INTO client_settings (config_key, config_value) VALUES (?, ?) "
            "ON CONFLICT(config_key) DO UPDATE SET config_value=excluded.config_value",
            (k, val_str),
        )
    conn.commit()
    conn.close()


# 插入或更新单条下载历史记录
def inshstry(data: Dict[str, Any]) -> None:
    conn = gtconn()
    cursor = conn.cursor()
    try:
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
        conn.commit()
    finally:
        conn.close()


# 查询全量下载历史记录列表
def gthstry() -> List[Dict[str, Any]]:
    conn = gtconn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM download_history ORDER BY download_time DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# 根据track_id删除下载历史记录
def dlthstry(track_id: str) -> None:
    conn = gtconn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM download_history WHERE track_id = ?", (track_id,))
    conn.commit()
    conn.close()


# 根据track_id查询单条历史记录
def gthstrybytrk(track_id: str) -> Optional[Dict[str, Any]]:
    conn = gtconn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM download_history WHERE track_id = ?", (track_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


# 更新单条下载记录的歌词路径
def updhstrylrc(track_id: str, lyrics_path: str) -> None:
    conn = gtconn()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE download_history SET lyrics_path = ? WHERE track_id = ?",
        (lyrics_path or "", track_id),
    )
    conn.commit()
    conn.close()


# 记录关键词搜索偏好频率
def rprtsrch(keyword: str) -> None:
    if not keyword or not keyword.strip():
        return
    conn = gtconn()
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
    conn.commit()
    conn.close()


# 获取推荐关键词列表
def gtrecmdtn(limit: int = 10) -> List[str]:
    conn = gtconn()
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
    conn.close()
    return [row["keyword"] for row in rows]


# 模块兼容性别名
get_connection = gtconn
init_db = intdb
get_all_settings = gtallstngs
save_settings = svstngs
insert_history = inshstry
get_history = gthstry
delete_history = dlthstry
get_history_by_track_id = gthstrybytrk
update_history_lyrics_path = updhstrylrc
report_search = rprtsrch
get_recommendations = gtrecmdtn

# 初始化数据库
intdb()
