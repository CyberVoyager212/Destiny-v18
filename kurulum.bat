@echo off
echo src klasorunde paketler kuruluyor...
if exist src (
    pushd src
    start /wait cmd /c "npm install"
    popd
) else (
    echo src klasoru bulunamadi.
)

echo Ana klasorde paketler kuruluyor...
start /wait cmd /c "npm install"

if exist kurulum.js (
    echo kurulum.js calistiriliyor...
    start /wait cmd /c "node kurulum.js"
) else (
    echo kurulum.js bulunamadi.
)

echo Temizlik islemleri yapiliyor...

if exist kurulum.js (
    del /f /q kurulum.js
    echo kurulum.js silindi.
)
if exist kurulum2.js (
    del /f /q kurulum2.js
    echo kurulum2.js silindi.
)

if exist package.json (
    del /f /q package.json
    echo package.json silindi.
)
if exist package-lock.json (
    del /f /q package-lock.json
    echo package-lock.json silindi.
)

if exist node_modules (
    rmdir /s /q node_modules
    echo node_modules klasoru silindi.
)

if exist src\webhook.png (
    del /f /q src\webhook.png
    echo src/webhook.png silindi.
)

if exist src\emojiler (
    rmdir /s /q src\emojiler
    echo src/emojiler klasoru silindi.
)

echo --------------------------------------------------
echo Tum islemler tamamlandi. Hatalar varsa yukarida gorunur.
echo Lutfen bu bat dosyasini siliniz!
echo --------------------------------------------------
pause