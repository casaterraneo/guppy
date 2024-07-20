using System.Net.Http.Json;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;

public class EmployeeClient
{
    private readonly HttpClient http;
    private Employee[]? employees;

    public EmployeeClient(HttpClient http)
    {
        this.http = http;
    }

    public async Task<Employee[]> GetEmployeeAsync()
    {
        try
        {
            employees = await http.GetFromJsonAsync<Employee[]>("Employee");
        }
        catch (AccessTokenNotAvailableException exception)
        {
            exception.Redirect();
        }

        return employees ?? Array.Empty<Employee>();
    }
}