namespace Blazor.Papi;

public class Game
{
    public string GameId { get; set; } = string.Empty;
    public List<Player> PlayerList { get; set; } = [];
    public List<string> ItemList { get; set; } = [];
    public string[] Board = [];
}    