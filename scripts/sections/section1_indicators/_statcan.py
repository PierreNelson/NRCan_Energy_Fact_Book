"""StatCan and Google Docs URL builders for Section 1."""

from datetime import datetime
from typing import List

import pandas as pd


def get_future_end_date() -> str:
    """Get end date 5 years in future for StatCan queries."""
    return f"{datetime.now().year + 5}0101"


def get_economic_contributions_url() -> str:
    """Get URL for Table 36-10-0610-01 (Economic contributions)."""
    end_date = get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
        f"pid=3610061001&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B39%2C48%2C54%2C55%2C57%5D%2C%5B%5D%5D"
        f"&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C5D1"
    )


def get_capital_expenditures_url() -> str:
    """Get URL for capital expenditures (needed for econ contributions)."""
    end_date = get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3410003601&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B8%2C9%2C11%2C34%2C36%2C37%2C50%2C91%5D%5D"
        f"&checkedLevels=0D1"
    )


def get_provincial_gdp_url() -> str:
    """Get URL for Table 36-10-0624-01 (Provincial NRSA GDP)."""
    end_date = get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3610062401&latestN=0&startDate=20070101&endDate={end_date}"
        f"&csvLocale=en&selectedMembers=%5B%5B1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C14%5D"
        f"%2C%5B2%5D%2C%5B2%5D%5D&checkedLevels="
    )


def get_gdp_emp_forecast_url() -> str:
    """Get URL for GDP&EMP forecast data from Google Docs."""
    return "https://docs.google.com/document/d/11ad-aqY6WjcQwHRWuSrZgQKxMD_U6jKaXlR5q-p0CXI/export?format=txt"


def store_publisher_rows(
    processor,
    source_key: str,
    df: pd.DataFrame,
    ref_date_col: str,
    value_col: str,
    dimension_cols: List[str],
    source_org: str = '',
    source_url: str = '',
) -> int:
    """Store CSV rows as publisher-native ingest (non-v* vectors)."""
    data_rows = []
    metadata_rows = []
    seen_vectors = set()
    for _, row in df.iterrows():
        if value_col not in df.columns or pd.isna(row.get(value_col)):
            continue
        ref_raw = row.get(ref_date_col)
        if pd.isna(ref_raw):
            continue
        try:
            ref_date = str(int(ref_raw))
        except (TypeError, ValueError):
            ref_date = str(ref_raw).strip()
        parts = [
            str(row[c]).strip()
            for c in dimension_cols
            if c in df.columns and pd.notna(row.get(c))
        ]
        vector = '|'.join(parts) if parts else ref_date
        try:
            value = float(row[value_col])
        except (TypeError, ValueError):
            continue
        data_rows.append((vector, ref_date, value))
        if vector not in seen_vectors:
            seen_vectors.add(vector)
            title = parts[-1] if parts else vector
            metadata_rows.append((vector, title, '', '', source_org, source_url))
    if not data_rows:
        return 0
    return processor.replace_raw_data(source_key, data_rows, metadata_rows)


def raw_to_dimension_df(raw_df: pd.DataFrame, dimension_names: List[str]) -> pd.DataFrame:
    """Expand pipe-delimited vector keys back into dimension columns."""
    rows = []
    for _, row in raw_df.iterrows():
        parts = str(row['vector']).split('|')
        record = {'ref_date': row['ref_date'], 'value': row['value']}
        for i, name in enumerate(dimension_names):
            record[name] = parts[i] if i < len(parts) else None
        rows.append(record)
    return pd.DataFrame(rows)
