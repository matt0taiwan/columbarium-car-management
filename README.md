# 納骨塔車輛管理系統

高峰日佛事車輛即時登記與交管放行系統。讓客服端登記、交管端即時看到最新車牌，告別 LINE 群組洗版與紙本表格。

## 開發背景

每逢清明、中元、農曆春節等高峰日，納骨塔需要實施車輛管制，只放行已預約佛事（晉塔、安香、百日、對年等）的客戶與禮儀業者車輛。

過去的作業流程：

1. 客服收到家屬／禮儀業者的車牌登記
2. **前一天**整理成 A4 紙本表格交給第一線交管同事
3. 當日臨時新增或更換車輛時，只能透過公司 LINE 群組告知第一線

問題在於：

- 第一線交管同事在現場非常忙碌，**沒辦法盯著 LINE 看訊息**
- 已預約的客戶被當成未登記車輛攔下，**引發客訴**
- LINE 群組被臨時車牌訊息洗版，正常溝通被淹沒
- 紙本表格無法即時更新，當日異動完全失靈

本系統解決這些痛點：

- **客服端**：客服同仁用手機或電腦即時登記／修改車輛
- **交管端**：第一線同事用手機看最新車輛清單，輸入車牌數字即可秒速查詢
- **15 秒自動刷新**：客服端的異動會即時同步到交管端
- **無紙化**：完全取代 A4 紙本表格
- **不再洗版**：LINE 群組回歸正常溝通用途

## 系統功能

### 客服端（`/admin`）

> 需要通過身份驗證才能進入，避免外部人士誤用。

- 新增車輛登記（支援同一筆登記**多車牌**一次輸入）
- 必填欄位：日期、車牌、申請人姓名
- 選填欄位：亡者姓名、佛事項目、預計到達時間、資訊來源（LINE 名字／仲介人名／電話）
- 預設佛事項目下拉選單：入塔安正、暫厝、安正、安香、合爐、做七、百日、對年、遷出、看塔、其他
- 編輯／刪除既有登記
- 切換查看其他日期的登記列表（前一天 / 後一天 / 任意日期）
- 統計儀表板：當日登記數、已到達、未到達、佛事項目分佈

### 交管端（`/guard`）

> 公開頁面，第一線同事手機加到書籤即可使用，免登入。

- **車牌快速查詢**：手機數字鍵盤直接輸入車牌數字進行模糊比對（針對台灣車牌設計）
- 今日車輛總覽
- 一鍵標記「已到達／取消到達」
- **每 15 秒自動刷新**，不需手動 reload
- 即時統計儀表板

## 技術架構

| 元件     | 內容                              |
| -------- | --------------------------------- |
| 後端     | Flask 3.1 + Flask-SQLAlchemy 3.1  |
| WSGI     | Gunicorn 23（2 workers）          |
| 資料庫   | SQLite（檔案儲存於 `data/`）      |
| 前端     | 原生 HTML / CSS / JavaScript      |
| 部署     | Docker + docker-compose           |
| Python   | 3.12-slim                         |

### 資料模型

`registrations` 表欄位：

| 欄位             | 型別     | 說明                       |
| ---------------- | -------- | -------------------------- |
| `id`             | Integer  | 主鍵                       |
| `date`           | Date     | 預計到訪日期（建索引）     |
| `applicant_name` | String   | 申請人姓名（必填）         |
| `deceased_name`  | String   | 亡者姓名                   |
| `service_type`   | String   | 佛事項目                   |
| `plate_number`   | String   | 車牌號碼（自動轉大寫）     |
| `visit_time`     | String   | 預計到達時間               |
| `source`         | String   | 資訊來源                   |
| `arrived`        | Boolean  | 是否已到達                 |
| `arrived_at`     | DateTime | 到達時間                   |
| `created_at`     | DateTime | 登記建立時間               |

## 快速啟動

### 使用 Docker（建議）

```bash
git clone https://github.com/matt0taiwan/columbarium-car-management.git
cd columbarium-car-management
docker compose up -d
```

服務啟動後：

- 客服端：<http://localhost:8585/admin>
- 交管端：<http://localhost:8585/guard>
- 健康檢查：<http://localhost:8585/health>

資料會持久化在 `./data/database.db`。

### 本機開發

```bash
pip install -r requirements.txt
python app.py
```

預設監聽 `0.0.0.0:8080`、debug 模式開啟。

## 環境變數

| 變數            | 預設值              | 說明                                       |
| --------------- | ------------------- | ------------------------------------------ |
| `DATABASE_PATH` | `data/database.db`  | SQLite 檔案路徑                            |
| `ADMIN_CODE`    | `80325199`          | 客服端身份驗證答案（建議部署時修改）       |

> 部署到正式環境時，請務必透過環境變數覆寫 `ADMIN_CODE`，不要使用預設值。

## API 一覽

| Method | Endpoint                              | 說明                       |
| ------ | ------------------------------------- | -------------------------- |
| GET    | `/api/registrations?date=YYYY-MM-DD`  | 取得指定日期登記列表       |
| POST   | `/api/registrations`                  | 新增登記                   |
| PUT    | `/api/registrations/<id>`             | 更新登記                   |
| DELETE | `/api/registrations/<id>`             | 刪除登記                   |
| POST   | `/api/registrations/<id>/arrive`      | 標記已到達                 |
| POST   | `/api/registrations/<id>/unarrive`    | 取消到達標記               |
| GET    | `/api/search?plate=XXX`               | 模糊查詢今日車牌           |
| GET    | `/api/stats?date=YYYY-MM-DD`          | 取得指定日期統計           |
| POST   | `/api/verify`                         | 客服端身份驗證             |
| GET    | `/health`                             | 健康檢查                   |

## 專案結構

```
columbarium-car-management/
├── app.py                  # Flask 主程式（路由 + API）
├── models.py               # SQLAlchemy 資料模型
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── templates/
│   ├── base.html           # 共用版面
│   ├── admin.html          # 客服端
│   └── guard.html          # 交管端
├── static/
│   ├── app.js              # 前端邏輯
│   └── style.css
└── data/
    └── database.db         # 執行後產生（已加入 .gitignore）
```

## License

僅供五湖園生命智慧園區內部使用。
