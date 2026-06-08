"""Shared StatCan URL and date helpers for Section 2."""

from datetime import datetime


def get_future_end_date() -> str:
    """Get end date 5 years in future for StatCan queries."""
    return f"{datetime.now().year + 5}0101"


def get_capital_expenditures_url() -> str:
    """Get URL for Table 34-10-0036-01 (Capital expenditures)."""
    end_date = get_future_end_date()
    # Use exact URL from working data_retrieval.py (note: -nonTraduit)
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3410003601&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B8%2C9%2C11%2C34%2C36%2C37%2C50%2C91%5D%5D"
        f"&checkedLevels=0D1"
    )


def get_infrastructure_url() -> str:
    """Get URL for Table 36-10-0608-01 (Infrastructure stock)."""
    end_date = get_future_end_date()
    # Use exact URL from working data_retrieval.py
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
        f"pid=3610060801&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%5D%2C%5B1%5D%2C%5B%5D%2C%5B48%5D%2C%5B%5D%5D"
        f"&checkedLevels=0D1%2C3D1%2C4D1%2C5D1%2C5D2"
    )


def get_investment_by_asset_url() -> str:
    """Get URL for investment by asset type (Table 36-10-0608-01)."""
    end_date = get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
        f"pid=3610060801&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B2%5D%2C%5B%5D%2C%5B40%2C41%2C42%2C43%2C44%2C45%2C46%2C48%2C57%5D%2C%5B%5D%5D"
        f"&checkedLevels=0D1%2C3D1%2C5D1"
    )


def get_international_investment_url() -> str:
    """Get URL for Table 36-10-0009-01 (International investment)."""
    end_date = get_future_end_date()
    # Use exact URL from working data_retrieval.py
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
        f"pid=3610000901&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%2C16%2C18%2C19%2C30%5D%2C%5B%5D%2C%5B%5D%5D"
        f"&checkedLevels=0D1%2C2D1%2C3D1"
    )


def get_foreign_control_url() -> str:
    """Get URL for Table 33-10-0570-01 (Foreign control)."""
    end_date = get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
        f"pid=3310057001&latestN=0&startDate=20100101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%2C9%2C11%5D%2C%5B2%5D%2C%5B2%5D%5D"
        f"&checkedLevels=0D1"
    )


def get_environmental_protection_url() -> str:
    """Get URL for Table 38-10-0130-01 (Environmental protection). Reference period from 2018."""
    end_date = get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
        f"pid=3810013001&latestN=0&startDate=20180101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B3%2C5%2C6%2C11%5D%2C%5B12%2C13%2C14%2C15%5D%5D"
        f"&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C3D2"
    )
