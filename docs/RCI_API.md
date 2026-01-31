**English** | [Русский](RCI_API.ru.md)

# RCI API

## 1. Overview

Keenetic/Netcraze devices provide a [REST](https://en.wikipedia.org/wiki/REST)-like
JSON API called **RCI** (**R**EST **C**ore **I**nterface). Data exchange is
carried out via the HTTP protocol, and the data is transmitted
in [JSON](https://en.wikipedia.org/wiki/JSON) format. This document provides
a description of the RCI API. It is assumed that the reader has basic knowledge
of configuring Keenetic/Netcraze devices using the command line (**C**ommand **L**ine **I**nterface, CLI).
You can learn more about the CLI for your device in the Command Reference Guide PDF
available on the manufacturer's website.

RCI is an implementation of REST principles on top of the CLI command system.
The base URL for all operations is `/rci`. A CLI command `a b c` corresponds
to a REST **resource** `rci/a/b/c`. Command arguments are passed as parameters
in the URL for GET requests (e.g. `GET rci/show/interface?name=Home`) or in the
body for POST requests. The table below shows examples of CLI commands and their
corresponding RCI resources.

| CLI Command                                  | RCI API resource                                               |
|----------------------------------------------|----------------------------------------------------------------|
| `interface Home ip address`                  | `/rci/interface/ip/address?name=Home`                          |
| `ip dhcp pool _WEBADMIN bind`                | `/rci/ip/dhcp/pool/bind?name=_WEBADMIN`                        |
| `interface Dsl0/Pvc0 pvc 2 35 encapsulation` | `/rci/interface/pvc/encapsulation?name=Dsl0/Pvc0&vpi=2&vci=35` |
| `show interface WifiMaster0 channels`        | `/rci/show/interface/channels?name=WifiMaster0`                |

> [!NOTE]
> Note that command arguments occupy different positions in the RCI resource URL
> compared to the CLI syntax.

Since HTTP clients (`curl`, `wget`, ...) are widely available and JSON is supported
by almost all programming languages, RCI is convenient for automating Keenetic/Netcraze
devices. Also, since JSON is natively supported in JavaScript, RCI allows you to interact
with your device directly from a web browser (if the web server is on the device, or if you
configure CORS headers).

RCI API supports typical REST query semantics, but also has a number of extra
features making it more flexible.

<br/>

> [!NOTE]
> For the purposes of this document we assume that no auth is required
> to access the RCI API on the target device (i.e., the default user
> on the device has no password). The password-based auth procedure
> is described in [AUTH.md](AUTH.md).

<br/>

<details>
<summary>An example of an RCI API request</summary>

```shell
curl http://192.168.1.1/rci/show/version # sends a GET HTTP request
```

```shell
$ curl http://192.168.1.1/rci/show/version


{
  "release": "5.01.A.0.0-0",
  "sandbox": "nightly",
  "title": "5.1 Alpha 0",
  "arch": "mips",
  ...
  "hw_id": "KN-2111",
  "device": "Carrier DSL",
  "region": "EU",
  "description": "Keenetic Carrier DSL (KN-2111)"
}
```
</details>


## 2. Types of resources

In REST APIs, request methods ([GET, POST, DELETE, ...](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods))
usually denote the purpose of the request. RCI follows this principle,
but not every resource supports every method. Quoting Appendix B from
the Command Reference Guide:

> Method semantics depend on the type of resource. There are three types of resources in RCI:
> - Settings
> - Actions
> - Background processes


### 2.1 Settings

Settings are parts of the device configuration. For example, a network interface
IP address, a traffic limit for unregistered devices, or `ip http security-level`
are all examples of settings. You can read, modify, or delete settings using standard HTTP methods:

- `GET` &rarr; Read settings.
- `POST` &rarr; Create or modify settings.
- `DELETE` &rarr; Delete (or reset to default) settings.

In general, the JSON structure returned when **reading** settings and the JSON structure
for **creating/modifying** those same settings are identical. Strings, integers, and booleans
are considered parameters of the addressed API resource. JSON objects and arrays represent
**nested resources**. An empty object (`{}`) denotes an empty set of parameters.

> [!IMPORTANT]
> Passing an empty object as request data is **required** for any POST request,
> even if the command has no parameters.

The ability to send JSON objects with any reasonable level of nesting makes RCI
convenient for developers. In the CLI you usually enter commands one by one (**).
With RCI, an entity (e.g. a network interface) can be represented as a whole with
a JSON object.

> ** You can paste multiple commands from the clipboard into the CLI,
> but the default way to use the command line interface is to enter commands
> one at a time. RCI, as a REST-like API, allows you to operate with objects
> each of which can represent a result of executing multiple commands.

<details>
    <summary>Editing an interface configuration via CLI and via RCI</summary>

<table>
<thead>
    <tr><th>CLI</th><th>RCI</th></tr>
</thead>
<tbody>
    <tr>
<td>

<img src="./svg/example-cli.svg"/><br/>
Creating/editing an object via CLI is a step-by-step procedure
</td>

<td>
<img src="./svg/example-rci.svg"/><br/>
Creating/editing an object via RCI can be done as a single action (HTTP request)
</td>
    </tr>
</tbody>
</table>

</details>


### 2.2 Actions

Actions are commands that do not modify the device configuration.
For example, reading the current CPU load, ejecting a USB storage device,
or clearing the system log are all examples of actions. Actions are executed instantly,
unlike [background processes](#23-background-processes).

- `GET` &rarr; Same as `POST` for `readonly` actions (see below); not applicable to other actions.
- `POST` &rarr; Execute the action and return its result.
- `DELETE` &rarr; Not applicable.

A certain subset of CLI commands are `readonly` commands. RCI resources corresponding
to such commands return the same result for both `GET` and `POST` requests. Usually,
`readonly` commands start with the `show` keyword, but not always. For example,
`rci/whoami` and `rci/ip/http/ssl/acme/list` are also `readonly` resources, even though
they do not start with `show`. In general, resources corresponding to actions do not
support `GET` requests. For example, `GET rci/eula/accept` will return an error.

For convenience, RCI also provides special prefixes (`rci/show/rc` and `rci/show/sc`)
that allow you to **read** settings via a `POST` request. See the
[Reading configuration via POST requests](#32-reading-configuration-via-post-requests)
section for more details. Resources with the `show/rc` and `show/sc` prefixes are also considered actions.

### 2.3 Background processes

Background processes are long-running operations that can be started, stopped,
and polled via RCI. Such processes are bound to a specific HTTP session and cannot
be accessed from elsewhere. Working with background processes is described in more
detail in section [Background Processes](#4-background-processes).

- `GET` &rarr; Retrieve updates from an existing process; returns 404 if the process is not running.
- `POST` &rarr; Start a background process.
- `DELETE` &rarr; Stop a background process.

<br/>

### 2.4 A few examples:

##### 2.4.1 `ip http security-level` (setting)

<details>
<summary>Read a setting (GET)</summary>

```shell
curl http://192.168.1.1/rci/ip/http/security-level
```

```shell
$ curl http://192.168.1.1/rci/ip/http/security-level


{
  "private": true
}
```
</details>

<details>
<summary>Write a setting (POST)</summary>

```shell
curl -X POST http://192.168.1.1/rci/ip/http/security-level \
  -H "Content-Type: application/json" \
  -d '{"private": true}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/ip/http/security-level \
  -H "Content-Type: application/json" \
  -d '{"private": true}'


{
  "status": [
    {
      "status": "message",
      "code": "18481702",
      "ident": "Http::Manager",
      "message": "security level set to private."
    }
  ]
}
```
</details>

`DELETE` is not applicable in that case

<br/>

##### 2.4.2. `interface {name} ...` (setting)

<details>
<summary>Read an interface configuration (GET)</summary>

```shell
# '?' and '=' are escaped for shell
curl http://192.168.1.1/rci/interface\?name\=Bridge1
```

```shell
$ curl http://192.168.1.1/rci/interface\?name\=Bridge1


{
  "Bridge1": {
    "rename": "Guest",
    "description": "Guest network",
    "traffic-shape": { // <-------- nested resource (can be accessed via `rci/interface/traffic-shape?name=Bridge1`)
      "rate": "5120"
    },
    "dyndns": {
      "nobind": false
    },
    "include": [ // <-------- nested resource (can be accessed via `rci/interface/include?name=Bridge1`)
      {
        "interface": "FastEthernet0/Vlan3"
      },
      {
        "interface": "WifiMaster0/AccessPoint1"
      },
      {
        "interface": "WifiMaster1/AccessPoint1"
      }
    ],
    ...
  }
}
```
</details>

<details>
<summary>Change an existing interface configuration (POST)</summary>

```shell
curl -X POST http://192.168.1.1/rci/interface \
  -H "Content-Type: application/json" \
  -d '{"Bridge1": {"up": false}}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/interface \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
  {
      "Bridge1": {
          "up": false
      }
  }
EOF
)


{
  "Bridge1": {
    "up": {
      "status": [
        {
          "status": "message",
          "code": "72155286",
          "ident": "Network::Interface::Base",
          "message": "\"Bridge1\": interface is down."
        }
      ]
    }
  }
}
```
</details>

<details>
<summary>OR create an interface (POST)</summary>

```shell
curl -X POST http://192.168.1.1/rci/interface \
  -H "Content-Type: application/json" \
  -d '{"PPTP0": {}}'
```

```shell
$ ~ curl -X POST http://192.168.1.1/rci/interface \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
  {
      "PPTP0": {}
  }
EOF
)


{
  "PPTP0": {
    "status": [
      {
        "status": "message",
        "code": "6553601",
        "ident": "Network::Interface::Repository",
        "message": "\"PPTP0\" interface created."
      }
    ]
  }
}
```
</details>

<details>
<summary>Delete an interface (DELETE) </summary>

```shell
curl -X DELETE http://192.168.1.1/rci/interface\?name\=PPTP0 \
  -H "Content-Type: application/json"
```

```shell
$ curl -X DELETE http://192.168.1.1/rci/interface\?name\=PPTP0 \
  -H "Content-Type: application/json"


{
  "status": [
    {
      "status": "message",
      "code": "6553605",
      "ident": "Network::Interface::Repository",
      "message": "interface \"PPTP0\" removed."
    }
  ]
}
```
</details>

<br/>

##### 2.4.3. `ip telnet` (nested setting)

There are a number of ways to access an API resource that is nested on the Nth level.
For example, if we want to read the `ip telnet` command configuration, we can:

<!--
    DO NOT try to adjust nesting of HTML tags in this section:
    it will break the parser with a high probability
-->
<ol type="A">
<li>

request the command-specific API resource (`ip telnet` -> `GET rci/ip/telnet`)

<details>
<summary>Requesting command-specific resource</summary>

```shell
curl http://192.168.1.1/rci/ip/telnet
```

```shell
$ curl http://192.168.1.1/rci/ip/telnet


{
  "security-level": {
    "private": true
  },
  "lockout-policy": {
    "threshold": "5",
    "duration": "15",
    "observation-window": "3"
  }
}
```
  </details>
</li>

<li>

request the <b>root</b> API resource (`GET rci/`) and process the JSON object it returns
(the response in this example has been omitted to avoid inflating overall size of the document)

</li>

<li>

request an "intermediate" resource (`GET rci/ip/` in this example) and process the JSON object it returns

<details>
<summary>Requesting an "intermediate" resource</summary>

<br/>

The response to this request contains configuration for each command
that starts with `ip ...`. The part that we are interested in can be accessed
via the `'telnet'` "path" in the returned JSON:<br/><br/>

`ip telnet` -> `GET rci/ip` + `'telnet'`
<br/>

```shell
curl http://192.168.1.1/rci/ip
```

```shell
$ curl http://192.168.1.1/rci/ip


{
  "dhcp": {
    ...
  },
  "http": {
    ...
  },
  "conntrack": {
    ...
  },
  "nat": [
    ...
  ],
  "telnet": { // <--- the part of the configuration we want to read
    "security-level": {
      "private": true
    },
    "lockout-policy": {
      "threshold": "5",
      "duration": "15",
      "observation-window": "3"
    }
  },
  "ssh": {
    ...
  },
  "hotspot": {
    ...
  }
}
```
  </details>
</li>
</ol>

<br/>

##### 2.4.4. `show system` ("read-only" action)

<details>
<summary>Execute the action (GET) </summary>

```shell
curl http://192.168.1.1/rci/show/system
```


```shell
$ curl http://192.168.1.1/rci/show/system


{
  "hostname": "Keenetic-1575",
  "domainname": "WORKGROUP",
  "cpuload": 3,
  "memory": "72076/131072",
  "swap": "16/131068",
  "memtotal": 131072,
  "memfree": 7572,
  "membuffers": 11872,
  "memcache": 39552,
  "swaptotal": 131068,
  "swapfree": 131052,
  "uptime": "942",
  "conntotal": 16384,
  "connfree": 16372
}
```
</details>


<details>
<summary>Execute the action (POST) </summary>

<br/>

```shell
curl -X POST http://192.168.1.1/rci/show/system \
  -H "Content-Type: application/json" \
  -d '{}' # an empty body is required
```

```shell
$ curl -X POST http://192.168.1.1/rci/show/system \
  -H "Content-Type: application/json" \
  -d '{}'


{
  "hostname": "Keenetic-1575",
  "domainname": "WORKGROUP",
  "cpuload": 3,
  "memory": "72156/131072",
  "swap": "16/131068",
  "memtotal": 131072,
  "memfree": 7492,
  "membuffers": 11872,
  "memcache": 39552,
  "swaptotal": 131068,
  "swapfree": 131052,
  "uptime": "1025",
  "conntotal": 16384,
  "connfree": 16371
}
```
</details>

<br/>

##### 2.4.5. `system reboot` (action)

<details>
<summary>Execute the action (POST) </summary>

```shell
curl -X POST http://192.168.1.1/rci/system/reboot\
  -H "Content-Type: application/json" \
  -d '{"interval": 5}' # an empty body will start the reboot process immediately
```

```shell
$ curl -X POST http://192.168.1.1/rci/system/reboot \
  -H "Content-Type: application/json" \
  -d '{"interval": 5}'


{
  "status": [
    {
      "status": "message",
      "code": "8519720",
      "ident": "Core::System::RebootManager",
      "message": "will activate system reboot in 5 seconds."
    }
  ]
}
```
</details>

<br/>


## 3. Additional features of RCI API

### 3.1 Root API resource

[Example 2.4.3](#243-ip-telnet-nested-setting) demonstrates the flexibility of RCI API
when querying a nested resource. That example also mentions the **root** API resource
(`/rci/` = `/rci` + `/`). The root resource is a [setting](#21-settings). If you query
the root resource via GET, you will receive a JSON object containing almost the entire
device configuration. Similarly, if you send a POST request to the root resource, you
can change almost any setting on your device. Having a root resource is an additional
feature of RCI compared to typical REST APIs.

The body of any POST request to the RCI API is limited in size to about a megabyte.
If you need to send multiple objects, it is convenient to combine them into an array.
The ability to send an array of objects, together with the root resource, allows you
to perform almost any operation with the device by sending POST requests to the root
resource (`/rci/`). Commands sent as an array will be executed in the order they appear.

#### Examples of multiple commands in a single HTTP query:

<details>
    <summary>Two action queries in an array</summary>

```shell
curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
   "show": {
     "system": {}
   }
 },
 {
   "show": {
     "clock": {
       "date": {}
     }
   }
 }
]
EOF
)
```

```shell
$ curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
   "show": {
     "system": {}
   }
 },
 {
   "show": {
     "clock": {
       "date": {}
     }
   }
 }
]
EOF
)


[
  {
    "show": {
      "system": {
        "hostname": "Keenetic-1575",
        "domainname": "WORKGROUP",
        ...
      }
    }
  },
  {
    "show": {
      "clock": {
        "date": {
          "weekday": 4,
          ...
        }
      }
    }
  }
]%
```
</details>

<details>
    <summary>Creating an interface and setting its description</summary>

```shell
curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
   "interface": {
     "name": "PPTP0"
   }
 },
 {
   "interface": {
     "PPTP0": {
      "description": "test"
     }
   }
 }
]
EOF
)
```

```shell
$ curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
   "interface": {
     "name": "PPTP0"
   }
 },
 {
   "interface": {
     "PPTP0": {
      "description": "test"
     }
   }
 }
]
EOF
)


[
  {
    "interface": {
      "status": [
        {
          "status": "message",
          "code": "6553601",
          "ident": "Network::Interface::Repository",
          "message": "\"PPTP0\" interface created."
        }
      ]
    }
  },
  {
    "interface": {
      "PPTP0": {
        "description": {
          "status": [
            {
              "status": "message",
              "code": "72155140",
              "ident": "Network::Interface::Base",
              "message": "\"PPTP0\": description saved."
            }
          ]
        }
      }
    }
  }
]%
```

</details>

<details>
    <summary>Combining actions and settings in the same array</summary>

<br/>

As you can see in this example, the first item in the array both creates
the `UsbModem0` interface and configures the `ip global order` setting on it.

```shell
curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
    "interface": {
      "name": "UsbModem0"
      "ip": {
        "global": {
          "enabled": true,
          "order": 0
        }
      }
    }
  },
  {},
  {
    "interface": {
      "name": "UsbModem0"
      "authentication": {
        "identity": {"no": true},
        "password": {"no": true},
        "no": true
      }
    }
  },
  {
    "show": {"last-change": {}}
  },
  {
    "system": {"configuration": {"save": {}}}
  }
]
EOF
)
```

```shell
$ curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
    "interface": {
      "ip": {
        "global": {
          "enabled": true,
          "order": 0
        }
      },
      "name": "UsbModem0"
    }
  },
  {},
  {
    "interface": {
      "authentication": {
        "identity": {
          "no": true
        },
        "password": {
          "no": true
        },
        "no": true
      },
      "name": "UsbModem0"
    }
  },
  {
    "show": {
      "last-change": {}
    }
  },
  {
    "system": {
      "configuration": {
        "save": {}
      }
    }
  }
]
EOF
)


[
  {
    "interface": {
      "status": [
        {
          "status": "message",
          "code": "6553601",
          "ident": "Network::Interface::Repository",
          "message": "\"UsbModem0\" interface created."
        }
      ],
      "ip": {
        "global": {
          "status": [
            {
              "status": "message",
              "code": "72746280",
              "ident": "Network::Interface::L3Base",
              "message": "\"UsbModem0\": order is 0."
            }
          ]
        }
      }
    }
  },
  {}, # <--------------- response to an empty object is also an empty object
  {
    "interface": {
      "authentication": {
        ...
      }
    }
  },
  {
    "show": {
      "last-change": {
        ...
      }
    }
  },
  {
    "system": {
      "configuration": {
        "save": {
          "status": [
            {
              "status": "message",
              "code": "8912996",
              "ident": "Core::System::StartupConfig",
              "message": "saving (http/rci)."
            }
          ]
        }
      }
    }
  }
]%
```
</details>

<br/>

### 3.2 Reading configuration via POST requests

RCI also allows you to **read** settings via a POST request by adding a special
prefix to the resource name. There are two such prefixes: `show rc` and `show sc`.

#### 3.2.1 The `show rc` prefix

`show rc` stands for `show running-config`. Wrapping a **setting** in
`{"show": {"rc": ...}}` in the POST request body will return the relevant part
of the configuration, read from the device's **running-config**. The device
configuration will not be changed.

> [!NOTE]
> It is important to note that adding the `show rc` prefix causes the JSON for
> the requested part of the configuration to be generated on every request.
> In some cases (e.g., `show rc interface`) this can be a resource-intensive operation.

<details>
<summary>Example request (POST)</summary>

```shell
curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d '{"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
{
  "show": {
    "rc": {
      "interface": {
        "Bridge1": {
          "description": {}
        }
      }
    }
  }
}
EOF
)


{
  "show": {
    "rc": {
      "interface": {
        "Bridge1": {
          "description": "Guest network"
        }
      }
    }
  }
}
```
</details>

<br/>

#### 3.2.2 The `show sc` prefix

`show sc` stands for `show startup-config`. This prefix is a cached version of
the `show rc` prefix, so requests to `show sc` are generally faster. Data returned
by requests wrapped in `show sc` is based on the **startup-config** file. The internal
representation (cache) of the requested part of the configuration is recreated only
when that file changes.

> [!TIP]
> Since `show sc` data is cached when the device configuration is saved,
> it is recommended to run the `system configuration save` command after any configuration change.

<details>
<summary>Example request (POST)</summary>

```shell
curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d '{"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
{
  "show": {
    "sc": {
      "interface": {
        "Bridge1": {
          "description": {}
        }
      }
    }
  }
}
EOF
)


{
  "show": {
    "sc": {
      "interface": {
        "Bridge1": {
          "description": "Guest network"
        }
      }
    }
  }
}
```
</details>

<br/>

<details>
<summary>

Example 2 (differences between `show rc` and `show sc`)
</summary>

<br/>

> Extra spaces/newlines removed for compactness

```shell
curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}},
  {"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}},

  {"interface": {"Bridge1": {"description": "A_NEW_VALUE"}}},

  {"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}},
  {"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}},

  {"system": {"configuration": {"save": {}}}},

  {"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}},
  {"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}}
]
EOF
) | jq -c '.[]'
```

```shell
$ curl -X POST http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}},
  {"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}},

  {"interface": {"Bridge1": {"description": "A_NEW_VALUE"}}},

  {"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}},
  {"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}},

  {"system": {"configuration": {"save": {}}}},

  {"show": {"rc": {"interface": {"Bridge1": {"description": {}}}}}},
  {"show": {"sc": {"interface": {"Bridge1": {"description": {}}}}}}
]
EOF
) | jq -c '.[]'


{"show":{"rc":{"interface":{"Bridge1":{"description":"Guest network"}}}}}
{"show":{"sc":{"interface":{"Bridge1":{"description":"Guest network"}}}}} # values are the same
{"interface":{"Bridge1":{"description":{"status":[{"status":"message","code":"72155140","ident":"Network::Interface::Base","message":"\"Bridge1\": description saved."}]}}}}
{"show":{"rc":{"interface":{"Bridge1":{"description":"A_NEW_VALUE"}}}}}
{"show":{"sc":{"interface":{"Bridge1":{"description":"Guest network"}}}}} # old value is still cached; the next command flushes the cache
{"system":{"configuration":{"save":{"status":[{"status":"message","code":"8912996","ident":"Core::System::StartupConfig","message":"saving (http/rci)."}]}}}}
{"show":{"rc":{"interface":{"Bridge1":{"description":"A_NEW_VALUE"}}}}}
{"show":{"sc":{"interface":{"Bridge1":{"description":"A_NEW_VALUE"}}}}} # values are the same again
```
</details>

<br/>

### 3.3 Deleting/resetting configuration via API requests

Settings can be deleted or reset to their default values. REST APIs assume that
this is done using `DELETE` requests. RCI supports this, but also allows you to
delete/reset settings using the `no` keyword (`"no": true`) in the POST request body,
similar to how you would use the `no` keyword in the CLI.

For example, to reset a specific property of a network interface, you can send a
POST request to the relevant resource path with `{"no": true}` as the value for that
property (see [example](#resetting-a-specific-property-within-an-object)).

<br/>

#### Examples of using the `no` keyword:

##### Deleting an entity (e.g., an item inside an array)

To delete a specific policy for a host by MAC address, you can use a DELETE request
with the MAC as a parameter, or a POST request with `no: true` in the body.

<details>
<summary>

Delete an `ip hotspot host policy` setting (DELETE)
</summary>

```shell
curl -X DELETE http://192.168.1.1/rci/ip/hotspot/host/policy\?mac\=22:22:22:22:22:22
```

```shell

$ curl -X DELETE http://192.168.1.1/rci/ip/hotspot/host/policy\?mac\=22:22:22:22:22:22


{
  "status": [
    {
      "status": "message",
      "code": "72746300",
      "ident": "Network::HotSpot::Host",
      "message": "\"22:22:22:22:22:22\": policy removed."
    }
  ]
}
```
</details>

<details>
<summary>

Delete an `ip hotspot host policy` setting (POST + `no`)
</summary>

```shell
curl -X POST http://192.168.1.1/rci/ip/hotspot/host/policy \
  -H "Content-Type: application/json" \
  -d '{"mac": "22:22:22:22:22:22","no" : true}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/ip/hotspot/host/policy \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
{
  "mac": "22:22:22:22:22:22",
  "no" : true
}
EOF
)


{
  "status": [
    {
      "status": "message",
      "code": "19007910",
      "ident": "Hotspot::Manager",
      "message": "policy removed from host \"22:22:22:22:22:22\"."
    }
  ]
}
```
</details>

<br/>

##### Resetting a specific property within an object

<details>
<summary>

Reset `interface Bridge1 description` to default (POST + `no: true`)
</summary>

```shell
curl -X POST http://192.168.1.1/rci/interface \
  -H "Content-Type: application/json" \
  -d '{"Bridge1": {"description": {"no": true}}}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/interface \
  -H "Content-Type: application/json" \
  -d '{"Bridge1": {"description": {"no": true}}}'


{
  "Bridge1": {
    "description": {
      "status": [
        {
          "status": "message",
          "code": "72155140",
          "ident": "Network::Interface::Base",
          "message": "\"Bridge1\": description removed."
        }
      ]
    }
  }
}
```
</details>

<br/>

##### Deleting all settings of a certain type (e.g., `ip nat`)

<details>
<summary>

Delete the settings (POST + `no: true`)
</summary>

```shell
curl -X POST http://192.168.1.1/rci/ip/nat \
  -H "Content-Type: application/json" \
  -d '{"no": true}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/ip/nat \
  -H "Content-Type: application/json" \
  -d '{"no": true}'


{
  "status": [
    {
      "status": "message",
      "code": "101122448",
      "ident": "Network::Nat",
      "message": "all NAT rules removed."
    }
  ]
}
```
</details>

<br/>

## 4. Background processes

Background processes are operations that may take a long time to complete.
To start a background process, send a POST request to the relevant API resource.
For background processes, it is more convenient to send requests to a command-specific
resource rather than to `/rci/`.

If the response to the initial POST request contains the `"continued": true` property,
it means the background process is still running. To get the updated status, you need
to send GET requests to the same resource until a response without `"continued": true`
is received. It is recommended to wait a short time (e.g., 1 second) between GET requests.

### 4.1 Examples of background processes

#### 4.1.1 Checking for firmware updates (`components list`)

To check for firmware updates, send a POST request to `/rci/components/list`.

Request that starts the background process (`POST`):

```shell
curl -X POST http://192.168.1.1/rci/components/list \
  -H "Content-Type: application/json" \
  -d '{}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/components/list \
  -H "Content-Type: application/json" \
  -d '{}'

{
  "continued": true
}
```

<br/>

Poll request (`GET`; process not finished):

```shell
curl http://192.168.1.1/rci/components/list
```

```shell
$ curl http://192.168.1.1/rci/components/list
{
  "continued": true
}

$ curl http://192.168.1.1/rci/components/list

{
  "continued": true
}

$ curl http://192.168.1.1/rci/components/list

{
  "continued": true
}
```

<br/>

Final response (example: no update):

```shell
curl http://192.168.1.1/rci/components/list
```

```shell
...

$ curl http://192.168.1.1/rci/components/list

{
  "sandbox": "nightly",
  "firmware": {
    "version": "5.01.A.0.0-0",
    "title": "5.1 Alpha 0"
  },
  "component": {
    ...
  }
}
```

#### 4.1.2 Sending USSD requests (`ussd send`)

To send a USSD request (e.g., to check balance), use the `/rci/ussd/send` resource.

Start the background process (`POST`):

```shell
curl -X POST http://192.168.1.1/rci/ussd/send \
  -H "Content-Type: application/json" \
  -d '{"interface": "UsbLte0", "request": "*100#"}' # both parameters are required
```

```shell
$ curl -X POST http://192.168.1.1/rci/ussd/send \
  -H "Content-Type: application/json" \
  -d '{"interface": "UsbLte0", "request": "*100#"}'

{
  "continued": true
}
```

Poll request (GET; process not finished):

```shell
curl http://192.168.1.1/rci/ussd/send
```

```shell
$ curl http://192.168.1.1/rci/ussd/send

{
  "continued": true
}
$ curl http://192.168.1.1/rci/ussd/send

{
  "continued": true
}
$ curl http://192.168.1.1/rci/ussd/send

{
  "continued": true
}
```

Final response (`GET`):

```shell
curl http://192.168.1.1/rci/ussd/send
```

```shell
$ curl http://192.168.1.1/rci/ussd/send


{
  "response": "Balance: 123.45 RUB"
}
```

#### 4.1.3 Ping (`tools ping`)

Start the background process (`POST`):

```shell
curl -X POST http://192.168.1.1/rci/tools/ping \
  -H "Content-Type: application/json" \
  -d '{"host": "google.com", "packetsize": 84, "count": 5}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/tools/ping \
  -H "Content-Type: application/json" \
  -d '{"host": "google.com", "packetsize": 84, "count": 5}'


# Even the initial response to the POST request may contain some data
{
  "message": [
    "sending ICMP ECHO request to google.com...",
    "PING google.com (142.250.184.206) 56 (84) bytes of data.",
    "84 bytes from google.com (142.250.184.206): icmp_req=1, ttl=115, time=11.20 ms."
  ],
  "continued": true
}
```

<br/>

Poll request (`GET`; process not finished):

```shell
curl http://192.168.1.1/rci/tools/ping
```

```shell
$ curl http://192.168.1.1/rci/tools/ping

{
  "message": [
    "84 bytes from google.com (142.250.184.206): icmp_req=2, ttl=115, time=10.77 ms.",
    "84 bytes from google.com (142.250.184.206): icmp_req=3, ttl=115, time=8.17 ms.",
    "84 bytes from google.com (142.250.184.206): icmp_req=4, ttl=115, time=7.05 ms.",
    "84 bytes from google.com (142.250.184.206): icmp_req=5, ttl=115, time=7.04 ms.",
    "",
    "--- google.com ping statistics ---",
    "5 packets transmitted, 5 packets received, 0% packet loss,",
    "0 duplicate(s), time 4010.14 ms."
  ],
  "continued": true
}

$ curl http://192.168.1.1/rci/tools/ping

{
  "message": [
    "Round-trip min/avg/max = 7.04/8.84/11.20 ms."
  ],
  "continued": true
}
```

Final response (`GET`):

```shell
curl http://192.168.1.1/rci/tools/ping
```

```shell
$ curl http://192.168.1.1/rci/tools/ping

{
}
```

### 4.2 Usage notes

RCI allows you to run multiple background processes associated with the same resource
in parallel. However, if you interact with the device within a single HTTP session
(as, for example, the device's web interface does), then polling request for any particular
type of background process will be the same. If you run multiple instances of the same
process with different arguments it will be impossible to determine which process you
are polling. If you need to run multiple background processes of the same type
you can either start each in a separate HTTP session or run them sequentially in one session.

A special case of a background process is the `system log` (or `mws log`) command.
After you start polling the system log, it will never return a response without
`"continued": true`. Some GET requests will also contain new log records in the response.
The started background process can be terminated by sending a DELETE request or by
ending the HTTP session it is bound to.

<br/>

## 5. Generic status/error messages

When you change settings or perform actions that do not return data via RCI,
responses often include a standard status object that informs you about the result.
The structure of this object is the same for different RCI resources:

```typescript
interface StatusItem {
  "status": "message" | "warning" | "error";
  "code": string;         // number as string
  "ident": string;        // "<Subsystem>::<Component>"
  "message": string;      // Human-readable description of the result
}

interface Status {
  status: StatusItem[];
}
```

Examples:

```json
{
  "status": [
    {
      "status": "message",
      "code": "18481702",
      "ident": "Http::Manager",
      "message": "security level set to private."
    }
  ]
}
```

```json
{
  "status": [
    {
      "status": "error",
      "code": "7405600",
      "ident": "Command::Base",
      "message": "no such command: foo."
    }
  ]
}
```

<details>

<summary>A more complex example</summary>

```shell
$ curl http://192.168.1.1/rci/ \
  -H "Content-Type: application/json" \
  -d @<(cat <<'EOF'
[
  {
    "interface": {
      "ip": {
        "address": [
          {
            "no": true
          }
        ]
      },
      "name": "L2TP0"
    }
  },
  {
    "ping-check": {
      "profile": {
        "name": "_WEBADMIN_L2TP0",
        "host": [
          "33.44.55.66"
        ],
        "update-interval": {
          "seconds": 10
        },
        "mode": "tls",
        "max-fails": {
          "count": "5"
        },
        "port": {
          "no": true
        }
      }
    }
  },
  {
    "interface": {
      "ping-check": {
        "profile": "_WEBADMIN_L2TP0"
      },
      "name": "L2TP0"
    }
  },
  {
    "system": {
      "configuration": {
        "save": {}
      }
    }
  }
]
EOF
)


[
  {
    "interface": {
      "status": [
        {
          "status": "message",
          "code": "6553601",
          "ident": "Network::Interface::Repository",
          "message": "\"L2TP0\" interface created."
        }
      ],
      "ip": {
        "address": [
          {
            "status": [
              {
                "status": "message",
                "code": "72220675",
                "ident": "Network::Interface::Ip",
                "message": "\"L2TP0\": IP address cleared."
              }
            ]
          }
        ]
      }
    }
  },
  {
    "ping-check": {
      "profile": {
        "status": [
          {
            "status": "message",
            "code": "41615361",
            "ident": "PingCheck::Client",
            "message": "profile \"_WEBADMIN_L2TP0\" has been created."
          }
        ],
        "host": [
          {
            "status": [
              {
                "status": "message",
                "code": "1900551",
                "ident": "PingCheck::Profile",
                "message": "\"_WEBADMIN_L2TP0\": Hosts cleared."
              }
            ]
          },
          {
            "status": [
              {
                "status": "message",
                "code": "1900549",
                "ident": "PingCheck::Profile",
                "message": "\"_WEBADMIN_L2TP0\": add host \"33.44.55.66\" for testing."
              }
            ]
          }
        ],
        "port": {
          "status": [
            {
              "status": "message",
              "code": "1900553",
              "ident": "PingCheck::Profile",
              "message": "\"_WEBADMIN_L2TP0\": port is cleared."
            }
          ]
        },
        "update-interval": {
          "status": [
            {
              "status": "message",
              "code": "1900545",
              "ident": "PingCheck::Profile",
              "message": "\"_WEBADMIN_L2TP0\": update interval is changed to 10 seconds."
            }
          ]
        },
        "mode": {
          "status": [
            {
              "status": "message",
              "code": "1900567",
              "ident": "PingCheck::Profile",
              "message": "\"_WEBADMIN_L2TP0\": uses tls mode."
            }
          ]
        },
        "max-fails": {
          "status": [
            {
              "status": "message",
              "code": "1900556",
              "ident": "PingCheck::Profile",
              "message": "\"_WEBADMIN_L2TP0\": uses 5 fail count for disabling interface."
            }
          ]
        }
      }
    }
  },
  {
    "interface": {
      "ping-check": {
        "profile": {
          "status": [
            {
              "status": "message",
              "code": "41615363",
              "ident": "PingCheck::Client",
              "message": "set \"_WEBADMIN_L2TP0\" ping-check profile for interface \"L2TP0\"."
            }
          ]
        }
      }
    }
  },
  {
    "system": {
      "configuration": {
        "save": {
          "status": [
            {
              "status": "message",
              "code": "8912996",
              "ident": "Core::System::StartupConfig",
              "message": "saving (http/rci)."
            }
          ]
        }
      }
    }
  }
]
```
</details>
