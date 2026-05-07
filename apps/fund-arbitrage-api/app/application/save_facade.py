from __future__ import annotations

from app.services import save_service


def get_fund_list(tab: str, device_id: str, page: int = 1, page_size: int = 20):
    return save_service.get_fund_list(tab=tab, device_id=device_id, page=page, page_size=page_size)


def get_fund_detail(code: str, market_type: str, device_id: str):
    return save_service.get_fund_detail(code=code, market_type=market_type, device_id=device_id)


def get_settings(device_id: str):
    return save_service.get_settings(device_id)


def update_basic_settings(device_id: str, payload):
    return save_service.update_basic_settings(device_id=device_id, payload=payload)


def update_advanced_settings(device_id: str, payload):
    return save_service.update_advanced_settings(device_id=device_id, payload=payload)


def update_favorite(device_id: str, code: str, market_type: str, starred: bool):
    return save_service.update_favorite(device_id=device_id, code=code, market_type=market_type, starred=starred)


def get_sync_status():
    return save_service.get_sync_status()


def refresh_all_data():
    return save_service.refresh_all_data()


def get_home(tab: str, device_id: str):
    return save_service.get_home(tab=tab, device_id=device_id)


def get_watchlist(device_id: str):
    return save_service.get_watchlist(device_id=device_id)


def get_calendar(filter_key: str, device_id: str):
    return save_service.get_calendar(filter_key=filter_key, device_id=device_id)


def get_profile(device_id: str):
    return save_service.get_profile(device_id=device_id)


def get_analysis(tab: str, device_id: str):
    return save_service.get_analysis(tab=tab, device_id=device_id)


def get_filter_options(device_id: str):
    return save_service.get_filter_options(device_id=device_id)


def get_bond_detail(code: str):
    return save_service.get_bond_detail(code=code)
