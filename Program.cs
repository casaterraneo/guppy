using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using OpenTelemetry;
using Blazor;
using OpenTelemetry.Trace;
using OpenTelemetry.Logs;
using OpenTelemetry.Resources;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");


builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

builder.Services.AddOidcAuthentication(options =>
{
    // Configure your authentication provider options here.
    // For more information, see https://aka.ms/blazor-standalone-auth
    builder.Configuration.Bind("Auth0", options.ProviderOptions);
    options.ProviderOptions.ResponseType = "code";
});

// var tracerProvider = Sdk.CreateTracerProviderBuilder()
//     .AddSource("Balzor")
//     .AddHttpClientInstrumentation()
//     //.AddOtlpExporter()
//     //.AddInMemoryExporter(exportedItems)
//     .AddConsoleExporter()
//     .Build();
  
builder.Logging.AddOpenTelemetry(logging =>
{
    var resourceBuilder = ResourceBuilder
        .CreateDefault()
        .AddService("Balzor");

    logging.SetResourceBuilder(resourceBuilder)
        .AddConsoleExporter();
});

await builder.Build().RunAsync();
