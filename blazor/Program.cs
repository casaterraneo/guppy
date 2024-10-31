using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Blazor;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
var environment = builder.HostEnvironment;
if (environment.IsStaging())
{
    // Logica per ambiente di staging
    Console.WriteLine("Siamo in ambiente di staging");
}

// Usa BaseAddress dell'host environment come fallback se non c'è un URL personalizzato
var baseUrl = builder.Configuration["BaseUrl"] ?? builder.HostEnvironment.BaseAddress;

builder.Services.AddHttpClient("northwind",
        client => client.BaseAddress = new Uri("https://northwind-api.casa-terraneo.workers.dev/api/"))
    .AddHttpMessageHandler(sp => sp.GetRequiredService<AuthorizationMessageHandler>()
    .ConfigureHandler(
        authorizedUrls: new [] { "https://northwind-api.casa-terraneo.workers.dev/api/" }
        //,scopes: new[] { "example.read", "example.write" }
        ));

builder.Services.AddHttpClient("kv",
        client => client.BaseAddress = new Uri(baseUrl))
    .AddHttpMessageHandler(sp => sp.GetRequiredService<AuthorizationMessageHandler>()
    .ConfigureHandler(
        authorizedUrls: new [] { baseUrl }
        //,scopes: new[] { "example.read", "example.write" }
        ));        

// builder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>()
//     .CreateClient("WebAPI"));        

builder.Services.AddOidcAuthentication(options =>
{
    // Configure your authentication provider options here.
    // For more information, see https://aka.ms/blazor-standalone-auth
    builder.Configuration.Bind("Auth0", options.ProviderOptions);
    options.ProviderOptions.ResponseType = "code";    
    options.ProviderOptions.AdditionalProviderParameters.Add("audience", "https://myapi.example.com");
    //options.ProviderOptions.DefaultScopes.Add("https://myapi.example.com");
});

await builder.Build().RunAsync();
