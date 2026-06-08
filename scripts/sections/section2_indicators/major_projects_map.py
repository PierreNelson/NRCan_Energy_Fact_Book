"""Major projects map (NRCan ArcGIS Feature Server)."""

import json

import requests


def update_major_projects_map(processor) -> int:
    """
    EEDAS ingest: fetch major projects map data from NRCan ArcGIS Feature Server.

    Fetches both English and French versions:
    - Point features (projects): energy projects with lat/lon coordinates
    - Line features (transmission lines/pipelines): with polyline geometries

    Returns:
        Number of rows fetched (combined EN + FR)
    """
    print("  Fetching Major Projects Map data from NRCan ArcGIS...")

    base_url_en = "https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/major_projects_inventory_en/MapServer"
    base_url_fr = "https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/major_projects_inventory_fr/MapServer"

    def fetch_data(base_url, lang, sector_filter):
        """Fetch point and line data for a specific language."""
        point_url = f"{base_url}/0/query"
        line_url = f"{base_url}/1/query"

        # Parameters matching data_retrieval.py exactly
        params = {
            "where": f"sector='{sector_filter}'",
            "outFields": "*",
            "f": "json",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultRecordCount": "2000"
        }

        # Alternative params for fallback (no server-side filter)
        params_fallback = {
            "where": "1=1",
            "outFields": "*",
            "f": "json",
            "returnGeometry": "true",
            "outSR": "4326"
        }

        points = []
        lines = []

        # Try with server-side filter first, then fallback to client-side
        try:
            print(f"    Fetching {lang} point features...")
            response = processor.fetch_url_with_retry(
                point_url, params=params, timeout=60, label=f"ArcGIS {lang} points"
            )
            point_data = response.json()

            if "features" in point_data and len(point_data["features"]) > 0:
                for feature in point_data["features"]:
                    attrs = feature.get("attributes", {})
                    geom = feature.get("geometry", {})

                    project = {
                        "id": attrs.get("id"),
                        "company": attrs.get("company"),
                        "project_name": attrs.get("project_name"),
                        "province": attrs.get("province"),
                        "location": attrs.get("location"),
                        "capital_cost": attrs.get("capital_cost"),
                        "capital_cost_range": attrs.get("capital_cost_range"),
                        "status": attrs.get("status"),
                        "clean_technology": attrs.get("clean_technology"),
                        "clean_technology_type": attrs.get("clean_technology_type"),
                        "lat": geom.get("y"),
                        "lon": geom.get("x"),
                        "type": "point"
                    }
                    points.append(project)
                print(f"      Found {len(points)} {lang} point features")
            elif "error" in point_data:
                # Try fallback with client-side filtering
                print(f"      Server filter failed, trying fallback...")
                response = processor.fetch_url_with_retry(
                    point_url, params=params_fallback, timeout=60, label=f"ArcGIS {lang} points fallback"
                )
                point_data = response.json()

                if "features" in point_data:
                    for feature in point_data["features"]:
                        attrs = feature.get("attributes", {})
                        geom = feature.get("geometry", {})

                        # Filter by sector client-side
                        if attrs.get("sector") != sector_filter:
                            continue

                        project = {
                            "id": attrs.get("id"),
                            "company": attrs.get("company"),
                            "project_name": attrs.get("project_name"),
                            "province": attrs.get("province"),
                            "location": attrs.get("location"),
                            "capital_cost": attrs.get("capital_cost"),
                            "capital_cost_range": attrs.get("capital_cost_range"),
                            "status": attrs.get("status"),
                            "clean_technology": attrs.get("clean_technology"),
                            "clean_technology_type": attrs.get("clean_technology_type"),
                            "lat": geom.get("y"),
                            "lon": geom.get("x"),
                            "type": "point"
                        }
                        points.append(project)
                    print(f"      Found {len(points)} {lang} point features (fallback)")
            else:
                print(f"      Warning: No {lang} point features found")

        except Exception as e:
            print(f"      Error fetching {lang} point features: {e}")

        # Fetch line features
        try:
            print(f"    Fetching {lang} line features...")
            response = processor.fetch_url_with_retry(
                line_url, params=params, timeout=60, label=f"ArcGIS {lang} lines"
            )
            line_data = response.json()

            if "features" in line_data and len(line_data["features"]) > 0:
                for feature in line_data["features"]:
                    attrs = feature.get("attributes", {})
                    geom = feature.get("geometry", {})

                    paths = geom.get("paths", [])
                    coordinates = []
                    for path in paths:
                        path_coords = []
                        for coord in path:
                            if len(coord) >= 2:
                                path_coords.append({"lon": coord[0], "lat": coord[1]})
                        if path_coords:
                            coordinates.append(path_coords)

                    line_project = {
                        "id": attrs.get("id"),
                        "company": attrs.get("company"),
                        "project_name": attrs.get("project_name"),
                        "province": attrs.get("province"),
                        "location": attrs.get("location"),
                        "capital_cost": attrs.get("capital_cost"),
                        "capital_cost_range": attrs.get("capital_cost_range"),
                        "status": attrs.get("status"),
                        "clean_technology": attrs.get("clean_technology"),
                        "clean_technology_type": attrs.get("clean_technology_type"),
                        "line_type": attrs.get("type"),
                        "paths": coordinates,
                        "type": "line"
                    }
                    lines.append(line_project)
                print(f"      Found {len(lines)} {lang} line features")
            elif "error" in line_data:
                # Try fallback with client-side filtering
                print(f"      Server filter failed for lines, trying fallback...")
                response = processor.fetch_url_with_retry(
                    line_url, params=params_fallback, timeout=60, label=f"ArcGIS {lang} lines fallback"
                )
                line_data = response.json()

                if "features" in line_data:
                    for feature in line_data["features"]:
                        attrs = feature.get("attributes", {})
                        geom = feature.get("geometry", {})

                        # Filter by sector client-side (use flexible match for encoding issues)
                        sector = attrs.get("sector", "")
                        # Match "Energy" or "Énergie" (handles encoding issues)
                        if "nerg" not in sector.lower():
                            continue

                        paths = geom.get("paths", [])
                        coordinates = []
                        for path in paths:
                            path_coords = []
                            for coord in path:
                                if len(coord) >= 2:
                                    path_coords.append({"lon": coord[0], "lat": coord[1]})
                            if path_coords:
                                coordinates.append(path_coords)

                        line_project = {
                            "id": attrs.get("id"),
                            "company": attrs.get("company"),
                            "project_name": attrs.get("project_name"),
                            "province": attrs.get("province"),
                            "location": attrs.get("location"),
                            "capital_cost": attrs.get("capital_cost"),
                            "capital_cost_range": attrs.get("capital_cost_range"),
                            "status": attrs.get("status"),
                            "clean_technology": attrs.get("clean_technology"),
                            "clean_technology_type": attrs.get("clean_technology_type"),
                            "line_type": attrs.get("type"),
                            "paths": coordinates,
                            "type": "line"
                        }
                        lines.append(line_project)
                    print(f"      Found {len(lines)} {lang} line features (fallback)")
            else:
                print(f"      Warning: No {lang} line features found")

        except Exception as e:
            print(f"      Error fetching {lang} line features: {e}")

        return points, lines

    en_points, en_lines = fetch_data(base_url_en, "English", "Energy")
    fr_points, fr_lines = fetch_data(base_url_fr, "French", "Énergie")

    # Build CSV rows
    csv_rows = []
    for lang_code, points, lines in [('en', en_points, en_lines), ('fr', fr_points, fr_lines)]:
        for point in points:
            row = {
                'lang': lang_code,
                'id': point.get('id', ''),
                'company': point.get('company', ''),
                'project_name': point.get('project_name', ''),
                'province': point.get('province', ''),
                'location': point.get('location', ''),
                'capital_cost': point.get('capital_cost', ''),
                'capital_cost_range': point.get('capital_cost_range', ''),
                'status': point.get('status', ''),
                'clean_technology': point.get('clean_technology', ''),
                'clean_technology_type': point.get('clean_technology_type', ''),
                'line_type': '',
                'lat': point.get('lat', ''),
                'lon': point.get('lon', ''),
                'paths': '',
                'type': 'point'
            }
            csv_rows.append(row)

        for line in lines:
            row = {
                'lang': lang_code,
                'id': line.get('id', ''),
                'company': line.get('company', ''),
                'project_name': line.get('project_name', ''),
                'province': line.get('province', ''),
                'location': line.get('location', ''),
                'capital_cost': line.get('capital_cost', ''),
                'capital_cost_range': line.get('capital_cost_range', ''),
                'status': line.get('status', ''),
                'clean_technology': line.get('clean_technology', ''),
                'clean_technology_type': line.get('clean_technology_type', ''),
                'line_type': line.get('line_type', ''),
                'lat': '',
                'lon': '',
                'paths': json.dumps(line.get('paths', [])),
                'type': 'line'
            }
            csv_rows.append(row)

    # Store in database for export
    if csv_rows:
        processor.repo.insert_major_projects_map(csv_rows)
        print(f"    Major Projects Map: stored EN({len(en_points)} points, {len(en_lines)} lines) FR({len(fr_points)} points, {len(fr_lines)} lines)")
        print(f"    Major Projects Map: {len(csv_rows)} rows saved to database")

    return len(csv_rows)


def process_major_projects_map(processor) -> int:
    """Deprecated: map export uses update only."""
    return update_major_projects_map(processor)
