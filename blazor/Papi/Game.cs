using System.Text.Json.Serialization;

namespace Blazor.Papi;

public class Game
{
    public enum GamePhase { Start, End }

    public string GameId { get; set; } = string.Empty;
    public List<Player> PlayerList { get; set; } = [];
    public List<string> ItemList { get; set; } = [];
    public string[] Board = [];

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public GamePhase Phase { get; set; } = GamePhase.Start;
    
    public string? GameResult { get; set; }

    public void CheckWinOrDraw()
    {
        int[,] wins = new int[,] {
            {0,1,2}, {3,4,5}, {6,7,8},
            {0,3,6}, {1,4,7}, {2,5,8},
            {0,4,8}, {2,4,6}
        };

        foreach (var symbol in new[] { "X", "O" })
        {
            for (int i = 0; i < wins.GetLength(0); i++)
            {
                if (Board[wins[i,0]] == symbol &&
                    Board[wins[i,1]] == symbol &&
                    Board[wins[i,2]] == symbol)
                {
                    GameResult = symbol;
                    Phase = GamePhase.End;
                    return;
                }
            }
        }

        if (Board.All(cell => !string.IsNullOrEmpty(cell)))
        {
            GameResult = "Draw";
            Phase = GamePhase.End;
        }
    }    
}

