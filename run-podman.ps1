Write-Host "Building Podman image 'tankattack-local'..." -ForegroundColor Cyan
podman build -t tankattack-local .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Please check the errors above." -ForegroundColor Red
    exit 1
}

Write-Host "Stopping and removing any existing 'tank-local' container..." -ForegroundColor Yellow
podman stop tank-local 2>$null
podman rm tank-local 2>$null

Write-Host "Starting new 'tank-local' container on port 3000..." -ForegroundColor Cyan
podman run -d -p 3000:3000 --name tank-local tankattack-local

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success! The game is now running locally." -ForegroundColor Green
    Write-Host "Open your browser to: http://localhost:3000" -ForegroundColor White
} else {
    Write-Host "Failed to start container!" -ForegroundColor Red
}
