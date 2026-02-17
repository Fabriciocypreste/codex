package main

import (
    "bytes"
    "encoding/json"
    "flag"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "time"
)

// Versão refinada do script de populaçao para testes locais.
// Suporta --dry-run, leitura de variáveis de ambiente e logs claros.

func main() {
    dry := flag.Bool("dry-run", false, "Imprimir payloads sem enviar")
    flag.Parse()

    supabaseURL := os.Getenv("SUPABASE_URL")
    supabaseKey := os.Getenv("SUPABASE_KEY")
    if supabaseURL == "" || supabaseKey == "" {
        // Também tentar ler das chaves VITE_ do .env (quando run via envFile no VS Code)
        if supabaseURL == "" {
            supabaseURL = os.Getenv("VITE_SUPABASE_URL")
        }
        if supabaseKey == "" {
            supabaseKey = os.Getenv("VITE_SUPABASE_ANON_KEY")
        }
    }

    if supabaseURL == "" || supabaseKey == "" {
        log.Fatalf("Erro: defina SUPABASE_URL e SUPABASE_KEY no ambiente antes de executar")
    }

    movies := []map[string]interface{}{
        {
            "title":       "Exemplo Filme 2022",
            "description": "Filme de teste inserido por script (2022).",
            "poster":      "https://via.placeholder.com/500x750.png?text=Filme+2022",
            "backdrop":    "https://via.placeholder.com/1200x675.png?text=Backdrop+Filme+2022",
            "logo_url":    "",
            "year":        2022,
            "rating":      7.2,
            "genre":       []string{"Drama", "Aventura"},
            "stream_url":  "https://example.com/stream/filme2022.m3u8",
            "tmdb_id":     1000001,
            "status":      "published",
        },
        {
            "title":       "Exemplo Filme 2023",
            "description": "Outro filme de teste (2023).",
            "poster":      "https://via.placeholder.com/500x750.png?text=Filme+2023",
            "backdrop":    "https://via.placeholder.com/1200x675.png?text=Backdrop+Filme+2023",
            "year":        2023,
            "rating":      6.8,
            "genre":       []string{"Comédia"},
            "stream_url":  "https://example.com/stream/filme2023.m3u8",
            "tmdb_id":     1000002,
            "status":      "published",
        },
    }

    series := []map[string]interface{}{
        {
            "title":       "Exemplo Série 2022",
            "description": "Série de teste (2022).",
            "poster":      "https://via.placeholder.com/500x750.png?text=Serie+2022",
            "backdrop":    "https://via.placeholder.com/1200x675.png?text=Backdrop+Serie+2022",
            "year":        2022,
            "rating":      8.1,
            "genre":       []string{"Drama"},
            "stream_url":  "",
            "tmdb_id":     2000001,
            "status":      "published",
        },
        {
            "title":       "Exemplo Série 2024",
            "description": "Série de teste (2024).",
            "poster":      "https://via.placeholder.com/500x750.png?text=Serie+2024",
            "backdrop":    "https://via.placeholder.com/1200x675.png?text=Backdrop+Serie+2024",
            "year":        2024,
            "rating":      7.9,
            "genre":       []string{"Família", "Aventura"},
            "tmdb_id":     2000002,
            "status":      "published",
        },
    }

    if *dry {
        prettyPrint("movies", movies)
        prettyPrint("series", series)
        fmt.Println("-- dry-run: nenhum dado enviado")
        return
    }

    client := &http.Client{Timeout: 20 * time.Second}

    if err := upsert(client, supabaseURL, supabaseKey, "movies", movies); err != nil {
        log.Fatalf("Falha upsert movies: %v", err)
    }
    log.Println("Filmes inseridos/atualizados com sucesso.")

    if err := upsert(client, supabaseURL, supabaseKey, "series", series); err != nil {
        log.Fatalf("Falha upsert series: %v", err)
    }
    log.Println("Séries inseridas/atualizados com sucesso.")
}

func prettyPrint(kind string, items interface{}) {
    b, _ := json.MarshalIndent(items, "", "  ")
    fmt.Printf("--- %s payload ---\n%s\n", kind, string(b))
}

func upsert(client *http.Client, supabaseURL, supabaseKey, table string, items interface{}) error {
    url := fmt.Sprintf("%s/rest/v1/%s?on_conflict=tmdb_id", supabaseURL, table)
    body, err := json.Marshal(items)
    if err != nil {
        return fmt.Errorf("marshal payload: %w", err)
    }

    req, err := http.NewRequest("POST", url, bytes.NewReader(body))
    if err != nil {
        return fmt.Errorf("new request: %w", err)
    }
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("apikey", supabaseKey)
    req.Header.Set("Authorization", "Bearer "+supabaseKey)
    req.Header.Set("Prefer", "return=representation")

    resp, err := client.Do(req)
    if err != nil {
        return fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    respBody, _ := io.ReadAll(resp.Body)

    if resp.StatusCode >= 400 {
        return fmt.Errorf("status %d: %s", resp.StatusCode, string(respBody))
    }

    // Log response (representation) — geralmente um array com objetos inseridos/atualizados
    log.Printf("[upsert %s] status=%d, response=%s", table, resp.StatusCode, string(respBody))
    return nil
}
