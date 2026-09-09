#!/bin/sh
# Depoyu yeni klonladıysan bir kez çalıştır: sh araclar/kanca-kur.sh
KOK="$(git rev-parse --show-toplevel)"
cat > "$KOK/.git/hooks/pre-commit" <<'EOF'
#!/bin/sh
python3 "$(git rev-parse --show-toplevel)/araclar/surum-yaz.py" || exit 1
git add "$(git rev-parse --show-toplevel)"/*.html
EOF
chmod +x "$KOK/.git/hooks/pre-commit"
echo "pre-commit kancası kuruldu — her commit'te sürüm etiketi kendiliğinden yenilenecek."
