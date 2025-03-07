export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const params = url.searchParams;
      const year = params.get("year");
      const make = params.get("make");
      const model = params.get("model");
      const format = params.get("format") || "html";

      if (!year || !make || !model) {
        return new Response("Missing year, make, or model query parameters.", { status: 400 });
      }

      console.log(`Fetching parts for ${year} ${make} ${model}`);

      const baseQuery = `${year} ${make} ${model} OEM`;
      const queries = [
        `${baseQuery} used`, `${baseQuery} upper`, `${baseQuery} front`,
        `${baseQuery} left`, `${baseQuery} center`, `${baseQuery} right`,
        `${baseQuery} rear`, `${baseQuery} lower`
      ];

      let allItems = [];
      for (const query of queries) {
        const searchUrl = `https://www.ebay.com/sch/i.html?_fsrp=1&_from=R40&_nkw=${encodeURIComponent(query)}&_sacat=0&LH_ItemCondition=4&LH_Sold=1&LH_TitleDesc=1&LH_PrefLoc=1&rt=nc`;
        const response = await fetch(searchUrl);
        const text = await response.text();

        const itemRegex = /<li class="s-item".*?>[\s\S]*?<\/li>/g;
        const matches = text.match(itemRegex) || [];
        
        matches.forEach((match) => {
          const titleMatch = match.match(/<h3 class="s-item__title">(.*?)<\/h3>/);
          const priceMatch = match.match(/<span class="s-item__price">\$([\d,\.]+)<\/span>/);
          const linkMatch = match.match(/<a.*?href="(https:\/\/www\.ebay\.com\/itm\/\d+)"/);
          const idMatch = linkMatch?.[1].match(/\/itm\/(\d+)/);

          if (titleMatch && priceMatch && linkMatch && idMatch) {
            allItems.push({
              title: titleMatch[1].replace(/<\/?[^>]+(>|$)/g, ""),
              price: parseFloat(priceMatch[1].replace(/,/g, "")),
              id: idMatch[1]
            });
          }
        });
      }

      const filteredItems = [...new Map(allItems.map(item => [item.title.toLowerCase(), item])).values()];

      if (format === "csv") {
        const csvContent = "Title,Price,Item ID,Link\n" + filteredItems.map(item =>
          `"${item.title.replace(/"/g, '""')}",${item.price},${item.id},"https://www.ebay.com/itm/${item.id}"`
        ).join("\n");
        return new Response(csvContent, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="ebay_${year}_${make}_${model}.csv"`
          }
        });
      } else {
        const htmlContent = filteredItems.map(item => `
          <div>
            <h3><a href="https://www.ebay.com/itm/${item.id}" target="_blank">${item.title}</a> - $${item.price}</h3>
            <a href="https://www.ebay.com/sl/list?mode=SellLikeItem&itemId=${item.id}" target="_blank" title="Sell Similar">Sell Similar</a>
          </div>
        `).join('');

        return new Response(`
          <html>
            <head><title>eBay Parts for ${year} ${make} ${model}</title></head>
            <body>
              <h1>eBay Parts for ${year} ${make} ${model}</h1>
              ${htmlContent}
            </body>
          </html>`, { headers: { "Content-Type": "text/html" } });
      }
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}