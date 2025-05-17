using System.Text.Json.Serialization;

namespace Blazor.Papi;

public class Game
{
    public enum GamePhase { Start, End }

    public string GameId { get; set; } = string.Empty;
    public List<Player> PlayerList { get; set; } = [];
    public List<string> ItemList { get; set; } = [];
    public string[][] Board { get; set; } = [];

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public GamePhase Phase { get; set; } = GamePhase.Start;

    public string? GameResult { get; set; }

    public void CheckWinOrDraw()
    {
        string[][] b = Board;

        var wins = new (int, int)[][]
        {
            new[] { (0,0), (0,1), (0,2) }, // righe
            new[] { (1,0), (1,1), (1,2) },
            new[] { (2,0), (2,1), (2,2) },

            new[] { (0,0), (1,0), (2,0) }, // colonne
            new[] { (0,1), (1,1), (2,1) },
            new[] { (0,2), (1,2), (2,2) },

            new[] { (0,0), (1,1), (2,2) }, // diagonali
            new[] { (0,2), (1,1), (2,0) }
        };

        foreach (var symbol in new[] { "X", "O" })
        {
            foreach (var line in wins)
            {
                if (line.All(pos => b[pos.Item1][pos.Item2] == symbol))
                {
                    GameResult = symbol;
                    Phase = GamePhase.End;
                    return;
                }
            }
        }

        if (b.All(row => row.All(cell => !string.IsNullOrEmpty(cell))))
        {
            GameResult = "Draw";
            Phase = GamePhase.End;
        }
    }

    public string GetTurn()
    {
        int countX = 0;
        int countO = 0;

        foreach (var row in Board)
        {
            countX += row.Count(c => c == "X");
            countO += row.Count(c => c == "O");
        }

        return countX == countO ? "X" : "O";
    }

    public bool IsMyTurn(string userName)
    {
        return Phase == GamePhase.Start &&
            PlayerList.Exists(p => p.Name == userName && p.PlayerId == GetTurn());
    }     
    
    public string? GetCurrentPlayer()
    {
        return PlayerList.FirstOrDefault(p => p.PlayerId == GetTurn())?.Name;
    }     
}

