#!/bin/sh
# Scarica e imposta dotnet
curl -sSL https://dot.net/v1/dotnet-install.sh > dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh -c 9.0 -InstallDir ./dotnet

# Mostra la versione di dotnet installata
./dotnet/dotnet --version

# Mostra il valore della variabile di ambiente DOTNET_ENVIRONMENT
echo "DOTNET_ENVIRONMENT: $DOTNET_ENVIRONMENT"

# Seleziona il file _headers in base all'ambiente
if [ "$DOTNET_ENVIRONMENT" = "Production" ]; then
    cp ./wwwroot/_headers_Production ./wwwroot/_headers
elif [ "$DOTNET_ENVIRONMENT" = "Staging" ]; then
    cp ./wwwroot/_headers_Staging ./wwwroot/_headers
else
    echo "Ambiente non riconosciuto, usando file _headers di default"
fi

# Pubblica l'app con dotnet
./dotnet/dotnet publish -c Release -o output -p:EnvironmentName=$DOTNET_ENVIRONMENT
