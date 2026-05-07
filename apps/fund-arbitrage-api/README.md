# 基金套利API

基于 FastAPI 的基金套利后端服务，提供 LOF/ETF 基金的实时数据查询和套利分析功能。

## 功能特性

- LOF基金列表查询
- ETF基金列表查询
- 基金实时价格和净值
- 溢价率计算
- 五档数据
- 套利策略分析
- 历史净值数据

## 快速开始

### 1. 安装依赖

```bash
cd apps/fund-arbitrage-api
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

打开浏览器访问: http://localhost:8000/docs

## API 接口

### LOF基金

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/lof/list` | GET | 获取LOF基金列表及实时数据 |
| `/api/lof/detail/{code}` | GET | 获取单个LOF基金详情 |

### ETF基金

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/etf/list` | GET | 获取ETF基金列表及实时数据 |
| `/api/etf/detail/{code}` | GET | 获取单个ETF基金详情 |

### 套利分析

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/arbitrage/detail/{code}` | GET | 获取基金完整详情（包含五档数据、历史净值、套利策略等） |
| `/api/arbitrage/strategies/{code}` | GET | 获取套利策略 |
| `/api/arbitrage/five-level/{code}` | GET | 获取五档数据 |

## 请求示例

### 获取LOF基金列表

```bash
curl http://localhost:8000/api/lof/list
```

### 获取基金详情

```bash
curl "http://localhost:8000/api/arbitrage/detail/163406?type=LOF"
```

## 数据来源

- 实时价格: 新浪财经
- 场外净值: 东方财富
- 历史数据: AkShare

## 技术栈

- FastAPI - Web框架
- AkShare - 金融数据接口
- Pydantic - 数据验证
- Uvicorn - ASGI服务器
