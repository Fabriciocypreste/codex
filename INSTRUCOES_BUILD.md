# Instruções de Compilação e Instalação - Projeto Multiplataforma (Jellyfin)

Este projeto contém o código fonte oficial dos clientes Jellyfin para Android TV, Tizen (Samsung) e WebOS (LG). Abaixo estão as instruções passo a passo para configurar o ambiente e compilar cada versão.

## Estrutura de Pastas

*   `platforms/android-tv`: Código nativo Android (Kotlin/Java).
*   `platforms/tizen`: Código para Samsung TV (requer Tizen Studio).
*   `platforms/webos`: Código para LG TV (requer WebOS SDK).
*   `platforms/jellyfin-web`: Interface web core (dependência para Tizen e WebOS).

---

## 1. Android TV

### Pré-requisitos
*   **Android Studio** (Recomendado) ou JDK 17+ e Android SDK instalados.
*   Variável de ambiente `JAVA_HOME` configurada.

### Como Compilar
1.  Abra a pasta `platforms/android-tv` no Android Studio.
2.  Aguarde a sincronização do Gradle.
3.  Selecione o build variant `debug`.
4.  Clique em **Run** ou execute no terminal:
    ```powershell
    cd platforms/android-tv
    ./gradlew assembleDebug
    ```
5.  O APK será gerado em: `platforms/android-tv/app/build/outputs/apk/debug/app-debug.apk`.

### Instalação
*   Ative o "Modo Desenvolvedor" e "Depuração USB" na sua Android TV/Box.
*   Instale via ADB:
    ```powershell
    adb install platforms/android-tv/app/build/outputs/apk/debug/app-debug.apk
    ```

---

## 2. Tizen (Samsung TV)

### Pré-requisitos
*   **Tizen Studio 4.6+** com IDE ou CLI.
*   Node.js 20+.
*   Git.

### Como Compilar
O cliente Tizen é um "wrapper" que carrega a interface web. Primeiro é necessário preparar a interface web.

1.  **Compilar Interface Web:**
    ```powershell
    cd platforms/jellyfin-web
    npm install
    $env:USE_SYSTEM_FONTS="1"
    npm run build:production
    ```

2.  **Preparar Pacote Tizen:**
    ```powershell
    cd ../tizen
    $env:JELLYFIN_WEB_DIR="../jellyfin-web/dist"
    npm install
    ```

3.  **Gerar WGT (Widget):**
    *   Abra o **Tizen Certificate Manager** e crie um perfil de certificado (Samsung ou Tizen).
    *   Execute o build:
    ```powershell
    tizen build-web -e ".*" -e gulpfile.babel.js -e README.md -e "node_modules/*" -e "package*.json" -e "yarn.lock"
    tizen package -t wgt -o . -- .buildResult
    ```
    *   O arquivo `Jellyfin.wgt` será gerado.

### Instalação
*   Conecte a TV e o PC na mesma rede.
*   Ative o "Developer Mode" na TV (Apps -> 12345).
*   Conecte via Device Manager ou CLI:
    ```powershell
    tizen install -n Jellyfin.wgt -t <NOME_DA_TV>
    ```

---

## 3. WebOS (LG TV)

### Pré-requisitos
*   **WebOS TV SDK** ou CLI (`ares-cli`).
*   Node.js e NPM.

### Como Compilar
Assim como o Tizen, o WebOS usa a interface web base.

1.  **Instalar Dependências:**
    ```powershell
    cd platforms/webos
    npm install
    ```

2.  **Empacotar (IPK):**
    ```powershell
    npm run package
    ```
    *   Isso irá gerar um arquivo `.ipk` (ex: `org.jellyfin.webos_1.0.0_all.ipk`).

### Instalação
*   Crie uma conta de desenvolvedor LG.
*   Instale o app "Developer Mode" na TV LG.
*   Ative o "Key Server" no app da TV.
*   Configure a conexão no PC:
    ```powershell
    ares-setup-device --search
    ares-novacom --device tv --getkey
    ```
*   Instale o IPK:
    ```powershell
    ares-install -d tv org.jellyfin.webos_*.ipk
    ```
