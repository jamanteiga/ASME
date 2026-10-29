@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem ============================================================
rem  subir_asme.bat - Sube C:\Users\jaman\Documents\PROYECTOS\ASME
rem  a https://github.com/jamanteiga/ASME (GitHub Pages)
rem  La primera vez se abre el navegador para iniciar sesion en
rem  GitHub; despues Windows guarda la credencial y no pide nada.
rem ============================================================
set "CARPETA=C:\Users\jaman\Documents\PROYECTOS\ASME"
set "REPO=https://github.com/jamanteiga/ASME.git"
set "NOMBRE=Jose Antonio Manteiga"
set "CORREO=jamanteiga@gmail.com"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado. Descargalo de https://git-scm.com/download/win
  echo         ^(deja marcado "Git Credential Manager" durante la instalacion^)
  pause & exit /b 1
)

cd /d "%CARPETA%" || (echo [ERROR] No existe %CARPETA% & pause & exit /b 1)

rem --- Credenciales guardadas en el Administrador de credenciales de Windows
git config --global credential.helper manager >nul 2>&1
git config --global credential.https://github.com.provider github >nul 2>&1

rem --- Rama por defecto del repositorio remoto (main o master)
set "RAMA=main"
for /f "tokens=2" %%R in ('git ls-remote --symref "%REPO%" HEAD 2^>nul ^| findstr /b "ref:"') do set "RAMA=%%R"
set "RAMA=!RAMA:refs/heads/=!"

if not exist ".git" (
  echo Inicializando repositorio local...
  git init -q
  git remote add origin "%REPO%"
  git fetch -q origin
  rem Adopta el historial remoto sin tocar los archivos locales
  git rev-parse -q --verify "origin/!RAMA!" >nul 2>&1 && git reset -q "origin/!RAMA!"
  git checkout -q -B !RAMA!
) else (
  git remote set-url origin "%REPO%"
  git fetch -q origin
)

git config user.name "%NOMBRE%"
git config user.email "%CORREO%"

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo No hay cambios que subir.
  pause & exit /b 0
)

for /f %%F in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "FECHA=%%F"
for /f "tokens=2" %%H in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "HORA=%%H"
git commit -q -m "Actualizacion !FECHA! !HORA!"

echo Subiendo a %REPO% (rama !RAMA!)...
git push -u origin !RAMA!
if errorlevel 1 (
  echo.
  echo [ERROR] El push ha fallado. Si el remoto tiene cambios hechos desde la web,
  echo         ejecuta:  git pull --rebase origin !RAMA!   y vuelve a lanzar este .bat
  pause & exit /b 1
)

echo.
echo OK. GitHub Pages se actualiza en 1-2 minutos:
echo   https://jamanteiga.github.io/ASME/
pause