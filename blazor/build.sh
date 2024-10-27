#!/bin/sh
# Scarica e imposta dotnet
curl -sSL https://dot.net/v1/dotnet-install.sh > dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh -c 8.0 -InstallDir ./dotnet

# Mostra la versione di dotnet installata
./dotnet/dotnet --version

# Mostra il valore della variabile di ambiente DOTNET_ENVIRONMENT
echo "DOTNET_ENVIRONMENT: $DOTNET_ENVIRONMENT"

# Pubblica l'app con dotnet
./dotnet/dotnet publish -c Release -o output
