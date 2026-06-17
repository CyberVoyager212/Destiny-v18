@off
chcp 65001 > nul
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [HATA] Lütfen bu dosyaya sağ tıklayıp "Yönetici Olarak Çalıştır" seçeneğini seçin!
    pause
    exit /b
)

:: ÇALIŞTIRILACAK BAT DOSYASININ YOLU
:: (Eğer başlatarkaplan.bat ile bu dosya aynı klasördeyse direkt adını yazar)
set "GorevYolu=%~dp0başlatarkaplan.bat"

:: GÖREV ZAMANLAYICIYA EKLEME KOMUTU
schtasks /create /tn "ArkaplanBaslatici" /tr "\"%GorevYolu%\"" /sc onstart /ru "SYSTEM" /f

if %errorLevel% equ 0 (
    echo [BAŞARILI] Görev başarıyla eklendi! Bilgisayar açıldığında arkaplanda çalışacak.
) else (
    echo [HATA] Görev eklenirken bir sorun oluştu.
)

pause