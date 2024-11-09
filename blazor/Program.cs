using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Blazor;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
var environment = builder.HostEnvironment;

var baseUrl = builder.Configuration["BaseUrl"] ?? builder.HostEnvironment.BaseAddress;

builder.Services.AddHttpClient("api", client => client.BaseAddress = new Uri(baseUrl))
    .AddHttpMessageHandler(sp => sp.GetRequiredService<AuthorizationMessageHandler>()
    .ConfigureHandler(
        authorizedUrls: [baseUrl]
        //,scopes: new[] { "example.read", "example.write" }
        ));              

builder.Services.AddOidcAuthentication(options =>
{
    // Configure your authentication provider options here.
    // For more information, see https://aka.ms/blazor-standalone-auth
    builder.Configuration.Bind("Auth0", options.ProviderOptions);
    options.ProviderOptions.ResponseType = "code";    
    //options.ProviderOptions.AdditionalProviderParameters.Add("audience", "https://myapi.example.com");
    //options.ProviderOptions.DefaultScopes.Add("https://myapi.example.com");
});

await builder.Build().RunAsync();
