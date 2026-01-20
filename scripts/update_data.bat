@echo off
REM Add Python to PATH for this session only (adjust path if needed)
SET PATH=C:\Python312;C:\Python311;C:\Python310;%PATH%

REM Navigate to the scripts directory
cd /d %~dp0

REM Run the data retrieval script
echo Fetching data from StatCan...
python data_retrieval.py

REM Copy data to public folder for web app
echo Copying data to public folder...
copy /Y ..\statcan_data\data.csv ..\public\statcan_data\data.csv
copy /Y ..\statcan_data\metadata.csv ..\public\statcan_data\metadata.csv

echo Data update complete!
pause
