haha foxgirl go brr  
  
![Sample Foxgirl](https://foxgirl.usbwire.net/fromthegithub)  
go look at foxgirls at https://mimi.usbwire.net/  
or just use this domain https://foxgirl.usbwire.net/  
my main website at https://usbwire.net/  

uses Caddy and Express together  
Snippet of Caddyfile:
```
foxgirl.usbwire.net {
	import tls
	handle {
		rewrite * /foxgirl{uri}
	}
	reverse_proxy localhost:42069
}
```
