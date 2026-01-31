[English](RCI_API.md) | **Русский**

# RCI API

## 1. Введение

Устройства Keenetic/Netcraze предоставляют [REST](https://ru.wikipedia.org/wiki/REST)-подобный
API под названием **RCI** (**R**EST **C**ore **I**nterface).
Обмен данными осуществляется по протоколу HTTP, данные передаются
в формате [JSON](https://ru.wikipedia.org/wiki/JSON). Этот документ содержит описание RCI API.
Предполагается, что читатель имеет базовые знания о настройке устройства
Keenetic/Netcraze при помощи командной строки (**C**ommand **L**ine **I**nterface &mdash; CLI).
Подробнее познакомиться с интерфейсом командной строки для вашего устройства
можно в документе под названием `Command Reference Guide`, доступном
в виде PDF на сайте производителя вашего устройства.

RCI &mdash; это реализация принципов REST поверх системы команд CLI.
Базовый URL для всех операций — `/rci`. Команде CLI `a b c` соответствует
REST **ресурс** `rci/a/b/c`. Аргументы команды передаются как параметры в URL
для GET-запросов (например, `GET rci/show/interface?name=Home`) или в теле запроса
для POST-запросов. В таблице ниже приведены примеры CLI-команд и соответствующие им ресурсы RCI.

| Команда в CLI                                | Ресурс RCI API                                                 |
|----------------------------------------------|----------------------------------------------------------------|
| `interface Home ip address`                  | `/rci/interface/ip/address?name=Home`                          |
| `ip dhcp pool _WEBADMIN bind`                | `/rci/ip/dhcp/pool/bind?name=_WEBADMIN`                        |
| `interface Dsl0/Pvc0 pvc 2 35 encapsulation` | `/rci/interface/pvc/encapsulation?name=Dsl0/Pvc0&vpi=2&vci=35` |
| `show interface WifiMaster0 channels`        | `/rci/show/interface/channels?name=WifiMaster0`                |

> [!NOTE]
> Обратите внимание, что аргументы команды занимают другие позиции в URL ресурса RCI,
> по сравнению с синтаксисом CLI.

В силу того, что HTTP-клиенты (`curl`, `wget`, ...) широко распространены,
а JSON поддерживается практически всеми языками программирования, RCI удобен
для автоматизации/программной настройки устройств Keenetic/Netcraze. Кроме того,
поскольку поддержка JSON встроена в JavaScript, RCI позволяет взаимодействовать
с вашим устройством прямо из веб-браузера (при условии, что веб-сервер находится
на самом устройстве или вы корректно настроили заголовки CORS).

RCI API поддерживает семантику запросов, типичную для REST API, а также имеет ряд
дополнительных возможностей, позволяющих более удобно его использовать.

<br/>

> [!NOTE]
> В этом документе предполагается, что для доступа к RCI API на целевом устройстве
> не требуется аутентификация (т.е., у пользователя по умолчанию пароль не установлен).
> Процедура аутентификации по паролю описана в [AUTH.ru.md](AUTH.ru.md).

<br/>

<details>
<summary>Пример запроса к RCI API</summary>

```shell
curl http://192.168.1.1/rci/show/version # отправляет GET HTTP-запрос
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


## 2. Типы ресурсов

В REST API методы запроса ([GET, POST, DELETE, ...](https://developer.mozilla.org/ru/docs/Web/HTTP/Methods))
обычно определяют назначение запроса. RCI следует этому принципу, но
не каждый ресурс поддерживает все методы. Цитируя приложение B из
`Command Reference Guide`:

> Семантика метода зависит от типа ресурса. В RCI есть три типа ресурсов:
> - Настройки
> - Действия
> - Фоновые процессы


### 2.1 Настройки

Настройки — это части конфигурации устройства. Например, IP-адрес сетевого интерфейса,
лимит трафика для незарегистрированных устройств или `ip http security-level`
являются примерами настроек. Вы можете читать, изменять или удалять настройки
с помощью стандартных HTTP-методов:

- `GET` &rarr; чтение настроек
- `POST` &rarr; создание или изменение настроек
- `DELETE` &rarr; удаление (или сброс к значению по умолчанию)

Как правило, структура JSON, возвращаемая при **чтении** настроек, и структура
JSON для **создания/изменения** этих настроек идентичны. Строки, целые числа
и булевы значения считаются параметрами адресуемого ресурса API. JSON-объекты
и массивы представляют **вложенные ресурсы**. Пустой объект (`{}`) обозначает
пустой набор параметров.

> [!IMPORTANT]
> Передача пустого объекта в качестве данных запроса **обязательна**
> для любого POST-запроса, даже если команда не имеет параметров.

Возможность передавать JSON-объекты с любым разумным уровнем вложенности
делает RCI удобным для разработчиков. В CLI вы обычно вводите команды
одну за другой (**). С помощью RCI конкретная сущность (например, сетевой
интерфейс) может быть целиком представлена в виде JSON-объекта.

> ** Вы можете вставить несколько команд из буфера обмена в CLI,
> но стандартный вариант использования интерфейса командной строки
> предполагает ввод команд по очереди. RCI, как REST-подобный API,
> позволяет работать с сущностями целиком или частями, принимая
> и отправляя JSON-объекты.

<details>
    <summary>Редактирование конфигурации интерфейса через CLI и через RCI</summary>

<table>
<thead>
    <tr><th>CLI</th><th>RCI</th></tr>
</thead>
<tbody>
    <tr>
<td>

<img src="./svg/example-cli.svg"/><br/>
Создание/редактирование объекта через CLI &mdash; пошаговая процедура
</td>

<td>
<img src="./svg/example-rci.svg"/><br/>
Создание/редактирование объекта через RCI может быть выполнено одним действием (HTTP-запросом)
</td>
    </tr>
</tbody>
</table>

</details>


### 2.2 Действия
Действия &mdash; это команды, которые не изменяют конфигурацию устройства.
Чтение текущей загрузки процессора, извлечение USB-накопителя и очистка
системного журнала &mdash; все это примеры действий. Действия выполняются мгновенно,
в отличие от [фоновых процессов](#23-фоновые-процессы).

- `GET` &rarr; то же, что и `POST` для `readonly`-действий (см. ниже); не имеет смысла для других действий
- `POST` &rarr; выполнить действие и вернуть результат
- `DELETE` &rarr; не имеет смысла

Определенное подмножество CLI-команд является `readonly`-командами. Ресурсы RCI,
соответствующие таким командам, возвращают одинаковый результат для `GET`- и
`POST`-запросов. Обычно `readonly`-команды начинаются с ключевого слова `show`,
но это не всегда так. Например, команды `whoami` и `ip http ssl acme list`
являются `readonly`-ресурсами, хотя и не начинаются с `show`. Ресурсы
`rci/whoami` и `rci/ip/http/ssl/acme/list` соответствующие этим командам вернут
один и тот же результат и в результат GET-, и в результате POST-запроса.
В общем случае ресурсы, соответствующие действиям, не поддерживают `GET`-запросы.
Например, запрос `GET rci/eula/accept` вернет ошибку.

Для большего удобства RCI также предоставляет специальные префиксы (`rci/show/rc` и `rci/show/sc`),
которые позволяют **читать настройки** через `POST`-запрос. Подробнее см. раздел
[Чтение конфигурации через POST-запросы](#32-чтение-конфигурации-через-post-запросы).
Ресурсы с префиксами `show/rc` и `show/sc` также считаются действиями.


### 2.3 Фоновые процессы
Фоновые процессы &mdash; это длительные процессы, которые можно запускать,
останавливать и опрашивать через RCI. Такие процессы привязаны к определенной
HTTP-сессии и не могут быть доступны из других мест. Работа с фоновыми процессами
описана подробнее в разделе [Фоновые процессы](#4-фоновые-процессы).

- `GET` &rarr; получить обновления от существующего процесса; возвращает ошибку 404, если процесс не запущен
- `POST` &rarr; запустить фоновый процесс
- `DELETE` &rarr; остановить фоновый процесс

<br/>

### 2.4 Примеры:

##### 2.4.1 `ip http security-level` (настройка)

<details>
<summary>Чтение настройки (GET)</summary>

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
<summary>Изменение настройки (POST)</summary>

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

`DELETE`-запрос не имеет смысла

<br/>

##### 2.4.2. `interface {name} ...` (настройка)

<details>
<summary>Чтение конфигурации интерфейса (GET)</summary>

```shell
# '?' и '=' экранированы для shell
curl http://192.168.1.1/rci/interface\?name\=Bridge1
```

```shell
$ curl http://192.168.1.1/rci/interface\?name\=Bridge1


{
  "Bridge1": {
    "rename": "Guest",
    "description": "Guest network",
    "traffic-shape": { // <-------- вложенный ресурс (`rci/interface/traffic-shape?name=Bridge1`)
      "rate": "5120"
    },
    "dyndns": {
      "nobind": false
    },
    "include": [ // <-------- вложенный ресурс (`rci/interface/include?name=Bridge1`)
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
<summary>Изменение существующей конфигурации интерфейса (POST)</summary>

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
<summary>ИЛИ создание интерфейса (POST)</summary>

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
<summary>Удаление интерфейса (DELETE) </summary>

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

##### 2.4.3. `ip telnet` (вложенная настройка)

Существует несколько способов получить доступ ко вложенному ресурсу RCI API.
Например, если мы хотим прочитать конфигурацию `ip telnet`, мы можем:

<ol type="A">
<li>

запросить командно-специфичный ресурс API (`ip telnet` -> `GET rci/ip/telnet`)

<details>
<summary>Запрос командно-специфичного ресурса</summary>

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

запросить <b>корневой</b> ресурс API (`GET rci/`) и обработать возвращаемый JSON-объект
(ответ в этом примере опущен для сокращения размера документа)

</li>

<li>

запросить "промежуточный" ресурс (`GET rci/ip/` в этом примере) и обработать возвращаемый JSON-объект

<details>
<summary>Запрос "промежуточного" ресурса</summary>

<br/>

Ответ на этот запрос содержит конфигурацию для каждой команды,
начинающейся с `ip ...`. Интересующая нас часть доступна
по "пути" `'telnet'` в возвращаемом JSON:<br/><br/>

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
  "telnet": { // <--- интересующая нас часть конфигурации
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

##### 2.4.4. `show system` (`readonly`-действие)

<details>
<summary>Выполнение действия (GET) </summary>

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
<summary>Выполнение действия (POST) </summary>

<br/>

```shell
curl -X POST http://192.168.1.1/rci/show/system \
  -H "Content-Type: application/json" \
  -d '{}' # пустой объект как тело запроса обязателен
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

##### 2.4.5. `system reboot` (действие)

<details>
<summary>Выполнение действия (POST) </summary>

```shell
curl -X POST http://192.168.1.1/rci/system/reboot\
  -H "Content-Type: application/json" \
  -d '{"interval": 5}' # пустое тело запроса запустит перезагрузку немедленно
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


## 3. Дополнительные возможности RCI API

### 3.1 Корневой ресурс API

[Пример 2.4.3](#243-ip-telnet-вложенная-настройка) показывает гибкость RCI API при запросе вложенного ресурса.
Там же упоминается **корневой ресурс** API (`/rci/` = `/rci` + `/`).
Корневой ресурс — это [настройка](#21-настройки). Если вы запросите корневой ресурс
через GET — вы получите JSON, содержащий практически полную конфигурацию
устройства. Аналогично, если вы отправите POST-запрос к корневому ресурсу,
вы сможете изменить почти любую настройку устройства. Наличие корневого ресурса
&mdash; одна из дополнительных возможностей RCI, по сравнению с типичным REST API.

Тело любого POST-запроса к RCI API имеет ограничение на размер порядка мегабайта.
Если требуется передать несколько объектов, то удобно объединить их в массив.
Возможность передавать массив объектов и наличие корневого ресурса RCI API
вместе позволяют выполнять практически любые действия с устройством, отправляя
POST-запросы к корневому ресурсу (`/rci/`). Команды, переданные в виде массива
будут выполнены в том порядке, в котором они указаны в массиве.

#### Примеры нескольких команд в одном HTTP-запросе:

<details>
    <summary>Два действия в массиве</summary>

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
    <summary>Создание интерфейса и установка его описания</summary>

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
    <summary>Комбинирование действий и настроек в одном массиве</summary>

<br/>

Как видно из примера, первый элемент массива одновременно создает
интерфейс `UsbModem0` и настраивает для него `ip global order`.

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
  {}, # <--------------- ответ на пустой объект — тоже пустой объект
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

### 3.2 Чтение конфигурации через POST-запросы

RCI также позволяет **читать** настройки через POST-запрос,
добавляя специальный префикс к имени ресурса. Для этого существует
два префикса: `show rc` и `show sc`.

#### 3.2.1 Префикс `show rc`

`show rc` — сокращение от `show running-config`.
**Настройка**, обернутая в `{"show": {"rc": ...}}` в теле POST-запроса
вернет соответствующую часть конфигурации, прочитав её из **running-config**
устройства. Конфигурация устройства при этом не изменится.

> [!NOTE]
> Важно отметить, что добавление префикса `show rc` приводит к тому, что
> JSON, соответствующий запрошенная части конфигурации генерируется при каждом
> запросе. В некоторых случаях это является ресурсоемкой операцией (например, `show rc interface`).

<details>
<summary>Пример запроса (POST)</summary>

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

#### 3.2.2 Префикс `show sc`

`show sc` — сокращение от `show startup-config`. Этот префикс — кэшированная
версия префикса `show rc`, поэтому запросы к `show sc` работают в среднем быстрее.
Данные, возвращаемые запросами с "оберткой" `show sc`, основаны на файле **startup-config**.
Внутреннее представление (кэш) запрошенной части конфигурации создается заново
только при изменении этого файла.

> [!TIP]
> Поскольку данные `show sc` кэшируются при сохранении конфигурации устройства,
> рекомендуется выполнять команду `system configuration save` после любого изменения конфигурации.

<details>
<summary>Пример запроса (POST)</summary>

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

Пример 2 (различия между `show rc` и `show sc`)
</summary>

<br/>

> Лишние пробелы/переводы строк удалены для компактности

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
) | jq -c '.[]' # // для компактного вывода ответа
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
{"show":{"sc":{"interface":{"Bridge1":{"description":"Guest network"}}}}} # значения совпадают
{"interface":{"Bridge1":{"description":{"status":[{"status":"message","code":"72155140","ident":"Network::Interface::Base","message":"\"Bridge1\": description saved."}]}}}}
{"show":{"rc":{"interface":{"Bridge1":{"description":"A_NEW_VALUE"}}}}}
{"show":{"sc":{"interface":{"Bridge1":{"description":"Guest network"}}}}} # старое значение все еще кэшировано; следующая команда сбрасывает кэш
{"system":{"configuration":{"save":{"status":[{"status":"message","code":"8912996","ident":"Core::System::StartupConfig","message":"saving (http/rci)."}]}}}}
{"show":{"rc":{"interface":{"Bridge1":{"description":"A_NEW_VALUE"}}}}}
{"show":{"sc":{"interface":{"Bridge1":{"description":"A_NEW_VALUE"}}}}} # значения снова совпадают
```
</details>

<br/>

### 3.3 Удаление/сброс конфигурации через API-запросы

Настройки можно удалить или сбросить к значениям по умолчанию.
REST API предполагает, что для этого испльзуются `DELETE`-запросы.
RCI поддерживает такую семантику, однако, также позволяет
удалять/сбрасывать настройки с помощью ключевого слова `no` (`"no": true`)
в теле POST-запроса, аналогично использованию ключевого слова `no` в CLI.

Например, чтобы сбросить конкретную настройку сетевого интерфейса,
можно отправить POST-запрос по соответствующему пути ресурса с `{"no": true}`
в качестве значения для этого свойства (см.
[пример](#сброс-конкретного-свойства-объекта)).

<br/>

#### Примеры использования ключевого слова `no`:

##### Удаление сущности (например, элемента массива)

Чтобы удалить конкретную политику для хоста по MAC-адресу,
можно использовать DELETE-запрос с MAC-адресом в качестве параметра
или POST-запрос с `no: true` в теле запроса.

<details>
<summary>

Удаление настройки `ip hotspot host policy` (DELETE)
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

Удаление настройки `ip hotspot host policy` (POST + `no`)
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

##### Сброс конкретного свойства объекта

<details>
<summary>

Сброс `interface Bridge1 description` к значению по умолчанию (POST + `no: true`)
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

##### Удаление всех настроек определенного типа (на примере `ip nat`)

<details>
<summary>

Удаление настроек (POST + `no: true`)
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

## 4. Фоновые процессы

Фоновые процессы — это операции, выполнение которых может занять длительное время.
Чтобы запустить фоновый процесс, необходимо отправить POST-запрос к соответствующему
ресурсу API. В случае с фоновыми процессами удобнее отправлять запросы к
командно-специфичному ресурсу, нежели чем к `/rci/`.

Если ответ на исходный POST-запрос содержит свойство `"continued": true`,
это значит, что фоновый процесс еще выполняется. Чтобы получить
обновленный статус процесса, нужно отправлять GET-запросы по тому же адресу,
пока не будет получен ответ без `"continued": true`. Рекомендуется делать
небольшую паузу между GET-запросами (например, 1 секунда).

### 4.1 Примеры фоновых процессов

#### 4.1.1 Проверка обновлений прошивки (`components list`)

Чтобы проверить наличие обновлений прошивки, отправьте POST-запрос к ресурсу
`/rci/components/list`.

Запрос, запускающий фоновый процесс (`POST`):

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

Запрос текущего состояния (`GET`; фоновый процесс не завершен):
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

Финальный ответ (приведен пример ответа для слчая, когда обновлений нет):
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

#### 4.1.2 Отправка USSD-запросов (`ussd send`)

Чтобы отправить USSD-запрос (например, для проверки баланса), используйте
ресурс `/rci/ussd/send`.

Запуск фонового процесса (`POST`):

```shell
curl -X POST http://192.168.1.1/rci/ussd/send \
  -H "Content-Type: application/json" \
  -d '{"interface": "UsbLte0", "request": "*100#"}' # оба параметра обязательны
```

```shell
$ curl -X POST http://192.168.1.1/rci/ussd/send \
  -H "Content-Type: application/json" \
  -d '{"interface": "UsbLte0", "request": "*100#"}'

{
  "continued": true
}
```

Запрос текущего состояния (GET; процесс **не** завершен)
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

Финальный ответ (`GET`):
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

Запуск фонового процесса (`POST`):

```shell
curl -X POST http://192.168.1.1/rci/tools/ping \
  -H "Content-Type: application/json" \
  -d '{"host": "google.com", "packetsize": 84, "count": 5}'
```

```shell
$ curl -X POST http://192.168.1.1/rci/tools/ping \
  -H "Content-Type: application/json" \
  -d '{"host": "google.com", "packetsize": 84, "count": 5}'


# Даже начальный ответ на POST-запрос может содержать часть данных
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

Запрос текущего состояния (`GET`; процесс не завершен):

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

Финальный ответ (`GET`):
```shell
curl http://192.168.1.1/rci/tools/ping
```

```shell
$ curl http://192.168.1.1/rci/tools/ping

{
}
```

### 4.2 Примечания по использованию RCI

RCI позволяет запускать несколько фоновых процессов, связанных
с одним и тем же ресурсом, параллельно. Однако, если вы взаимодействуете
с устройством в рамках одной HTTP-сессии (как, например, веб-интерфейс устройства),
то при опросе статуса одного из этих процессов невозможно определить,
какой именно процесс вы опрашиваете (URL для GET-запросоов будет одинаковым
для всех фоновых процессов). Если нужно запустить несколько
фоновых процессов одного типа (например, с разными аргументами),
можно либо запускать каждый из них в отдельной HTTP-сессии, либо
выполнять их последовательно в одной сессии.

Особый случай фонового процесса — команда `system log` (или `mws log`).
После начала опроса системного журнала он никогда не вернет ответ
без `"continued": true`. Ответы на некоторые GET-запросы также будут содержать
новые записи журнала по мере их появления. Запущенный фоновый процесс
можно завершить либо отправив DELETE-запрос, либо завершив HTTP-сессию, к которой он привязан.

<br/>

## 5. Универсальный блок статуса выполнения команды

Когда вы изменяете настройки или выполняете действия, не возвращающие данные через RCI,
ответы часто содержат стандартный объект-статус, информирующий о результате операции.
Структура этого объекта одинакова для разных ресурсов RCI:

```typescript
interface StatusItem {
  "status": "mesage" | "warning" | "error"  //
  "code": string;                           // число в виде строки
  "ident": string;                          // "<Подсистема>::<Компонент>",
  "message": string;                        // "Человекочитаемое описание результата операции."
}

interface Status {
  status: StatusItem[];
}
```

Примеры:

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

<summary>Более сложный пример</summary>

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
