# Company USD rate predictor

Predicts the company's monthly USD→RUB rate from the Central Bank (CBR) daily rates.

[Русская версия ниже](#прогноз-курса-компании)

## Use it

Double-click `predictor.html`. It opens in any browser and needs no installation, but the `src` folder must stay next to it. The sidebar has five sections:

- Rate forecast: the predicted company rate for the current month with a likely range, a field for the CBR rate you expect for the rest of the month (defaults to the latest rate), and the history chart and table comparing the model with past company rates. Finished months without a company rate yet show their CBR average and the model's estimate. Under the table you can enter a month's company rate once it is known; it is saved in the browser, and "Download company rates CSV" gives the full list to put in `data/company_rates.csv`
- Salary: the salary calculator described below
- Salary history: what your salary would have been in past months
- Earnings: every payment of a year with dates, vacation pay and a calendar
- Settings & data: model settings, income tax, loading CSV files, salary statistics, and how the prediction works

The address bar remembers the open section (`predictor.html#salary`), so you can bookmark one.

On open, the page fetches any new CBR rates from cbr-xml-daily.ru, a public mirror of CBR data. Without internet it uses the rates in `src/data.js`.

## Salary

The "Salary" section estimates pay under the rate-linked scheme. A fixed share of the current salary X is paid as is. The rest is multiplied by Y, which depends on the company rate: Y = 0 at the lower bound, 1 at the base rate, and at most the maximum Y. The scheme's numbers are set in the Salary section. The defaults are only an example (fixed share 0.5, lower bound 50 ₽, base 80 ₽, upper bound 100 ₽, maximum Y 2), so enter your own. The rate comes from the Rate forecast section, or you can type your own.

There are two ways to get Y between the bounds:

- Two pieces: one straight line from the lower bound to the base, another from the base to the upper bound (100 ₽ → 2). Every bound gives exactly its Y.
- One line: a single line through the lower bound and the base (1/30 ≈ 0.033 per ruble with the defaults), capped at the maximum Y. The cap of 2 is reached at 110 ₽, so at 100 ₽ Y is 1.667.

The "Raise, %" field applies a raise to X before the split. For example, X = 100 000 with a 10% raise gives a base of 110 000, and with the default fixed share of 0.5, at Y ≈ 1.09 the salary is 115 000. The page shows the total change from the original X (+15%) and splits it into the raise (+10%) and the exchange rate (+5%). It also shows the break-even rate, the company rate at which the raised salary equals the current X. With the default settings and a 10% raise that is 74.55 ₽: below it, the rate takes back more than the raise gives. When the rate comes from the forecast, the page says whether the forecast range is above or below this level. Taxes don't move the break-even rate, so it is the same in the gross and net views.

The "Salary history" card shows what a salary of X would have paid in each month that has a company rate under the new system, using that month's actual company rate (the raise is not included). Green bars are months above X, red bars months below. The card also lists the total and average difference over the period.

All settings, the salary and the raise are saved in the browser.

## Earnings

The "Earnings" section shows every payment of a year: when the money comes and how much.

- Salary is paid twice a month. On the 25th comes an advance for the working days from the 1st to the 15th: monthly salary × those days ÷ working days in the month. On the 10th of the next month comes the rest of the month. If the date is a weekend or holiday, the money comes on the last working day before it, even in the previous month or year (10 January 2027 is paid on 30 December 2026 and counts in 2026).
- Under the new system the advance covers only the fixed share. The rate-linked part comes with the rest on the 10th, at that month's company rate. Months without a company rate use the forecast: the rate predicted from the CBR rates published so far, and the current month's forecast for future months.
- Salary periods say what was paid when: from a date, a monthly salary, the old or the new system. A period lasts until the next one starts. A change in the middle of a month splits that month by working days. The new system uses the fixed share and multiplier from the Salary section; the "Raise" field there is not used here.
- Vacation days are not paid as salary. Vacation pay comes on the last working day before the vacation: average daily earnings × vacation days, where weekends count and public holidays don't. Average daily earnings follow the Labour Code: salary for the 12 full months before the vacation month ÷ days, a fully worked month counting as 29.3 days and a month with vacation as 29.3 × days not on vacation ÷ days in the month.
- A vacation can instead be marked as "Compensation": you keep working and get your salary as usual, and on top of it the same vacation pay for those days, calculated the same way and paid on the same date (the last working day before the first day). Compensated days are not taken out of the average earnings of later vacations, and a weekend inside them can still be marked as worked. A compensation can't overlap a real vacation.
- Work on a weekend or holiday pays twice the daily rate of its month (monthly salary ÷ working days × 2; under the new system with Y applied like the rest of the salary). It is paid like salary, by the day's date: days on the 1st–15th with the advance on the 25th (only the fixed share under the new system, the rate-linked part on the 10th), later days on the 10th of the next month. In the advance such a day on the 1st–15th also counts as a worked day, so one more day of salary comes on the 25th and the same amount less on the 10th; the month's total doesn't change. For example, in May 2025 (18 working days) with 1, 2, 8 and 9 May worked and a salary of 150 000 ₽, the advance on 23 May is 19/18 of the salary, 158 333 ₽ (137 750 ₽ after 13% tax), and the rest on 10 June is 7/18, 58 333 ₽ (50 750 ₽ after tax). It counts in the earnings used for vacation pay. Add these days under "Work on days off" or click a weekend or holiday in the calendar; a date that is a working day, on vacation or before the first salary period is shown in red and left out.
- With income tax on, tax is withheld from each payment year to date, by payment date, and the section gets the "Before tax / After tax" toggle.

The section also shows a calendar of the year with working days, weekends, public holidays, vacations, worked days off and paydays, and the year's day counts.

Under each month the calendar shows what was earned for that month, whenever it was paid: the month's salary (the advance on the 25th plus the rest on the 10th of the next month, worked days off included) and the vacation or compensation pay for the days that fall in it. Hover it to see the parts. Vacation pay is split by day, so a vacation from 28 January to 10 February counts partly in January and partly in February, although it was paid in January. After tax, each part takes the tax of the payment it came with. The year's total for work done in it is listed above the payments; it differs from "Paid in" because December's rest comes in January and vacation pay may come in the month before.

Vacations can be entered one by one or loaded from a CSV with the first and last day on each line and optionally the type (`2026-08-10;2026-08-23` or `2026-08-10;2026-08-23;compensation`; without a type it is a vacation; a single date is a one-day vacation; a comma works as the separator too). Loading a file replaces the list. "Download vacations template" gives a CSV with the current vacations, or only the header if there are none, to fill in and load back.

The Russian production calendar for 2024–2027 is built in (`data/holidays.csv`, embedded by `update_data.py`). "Download from xmlcalendar.ru" fetches the calendars for the years in the year list (the earliest data up to next year) from the xmlcalendar.ru data repository on GitHub; years not published yet are listed in the status line. The page can't read xmlcalendar.ru itself because that site doesn't allow requests from other pages. "Download template for <year>" gives the selected year's calendar as a CSV to edit and load back. A downloaded or loaded year replaces that year of the built-in calendar; "Reset to built-in calendar" undoes all of them. Accepted file formats:

- CSV with `date;type` lines (or `date,type`), type `holiday` (public holiday), `dayoff` (non-working weekday) or `workday` (working Saturday or Sunday). Other days follow Monday–Friday.
- The official production calendar CSV from data.gov.ru: a row per year, a column per month listing its days off (`*` shortened day, `+` moved day off).
- XML from xmlcalendar.ru (`https://xmlcalendar.ru/data/ru/<year>/calendar.xml`).

For a year without a calendar only weekends and the public holidays of art. 112 of the Labour Code are days off.

Salary periods, vacations, worked days off and loaded or downloaded calendars are saved in the browser.

## Income tax

Tax is off by default. Turn it on with "Account for income tax" in Settings & data. X is always entered before tax. The Salary, Salary history and Earnings sections then get a "Before tax / After tax" toggle. All these toggles share one setting.

Tax rates are set as yearly ranges. Each rate applies only to the part of the year's income inside its range. The defaults are Russian NDFL 2025: 13% up to 2.4 million ₽, 15% to 5 million, 18% to 20 million, 20% to 50 million, 22% above. You can edit, add or remove ranges, or reset them.

Tax is withheld year to date, like NDFL. A month's tax is the tax on all income since January minus what was already withheld. With X = 300 000 the first eight months net 261 000 ₽ each. September is the first month after income passes 2.4 million, so it nets 255 000 ₽. For the history, earlier months of the same year use their actual salaries (months without a company rate count as X). After tax, each month is compared with what X alone would have netted in that month, so the dashed X line steps down when X crosses a range. On the Salary page the raise counts from the selected month on.

## How it works

The company rate tracks the average CBR rate for the same calendar month, multiplied by a spread `k`. The app:

1. averages the CBR rates already published this month,
2. fills the remaining publication days (Tuesday to Saturday) with your expected rate,
3. multiplies the result by `k`, the median company ÷ CBR ratio over the last 12 months.

The backtest shows how far past predictions were off. Early in a month the error is larger, because most of the month's rates are still unknown.

The repository has no company rates (`data/company_rates.csv` holds only the header), so a fresh copy can't predict until it has some. Enter each month's company rate under the history table, or load a CSV in Settings & data. Both are saved in your browser.

## Updating the data

Company rates are kept out of the repository. Put them in `private/company_rates.csv` (`private/` is in `.gitignore`) and add a line each month:

```
1,01.10.2026,84.10,Доллар США
```

Then run (Python 3.8+, no packages to install):

```
python update_data.py
```

The script downloads missing CBR rates from cbr.ru into `data/cbr_usd.csv`, regenerates `src/data.js` from the CSV files in `data/` (so without company rates), and prints the current prediction from `private/company_rates.csv` if it exists. To share, run `python make_zip.py`. The archive it builds embeds the rates from `private/company_rates.csv` in its `src/data.js` and takes the pay-scheme defaults from `private/scheme.json` (for example `{"fixed": "0.5", "lower": "50", "base": "80", "upper": "100", "yMin": "0", "yMax": "2"}`, with your own numbers). The repository itself keeps neither.

Options:

- `--no-fetch`: only regenerate `src/data.js` (offline)
- `--month 2026-10 --expected 85.5`: prediction for a given month and expected rate
- `--months 24`: number of past months used for `k` (0 means all)

Without Python, load the CSV files through the "Data" section of the page. Loaded data is saved in that browser only.

CSV format: `nominal,date,curs,cdx`. Dates can be `M/D/YYYY` (as in `cbr_usd.csv`), `DD.MM.YYYY` or `YYYY-MM-DD`. The separator can be a comma or a semicolon.

## Salary statistics

Optional, and off until you agree. If statistics are enabled in your copy, the first time you open the page it asks whether you want to take part. If you agree, it sends your current salary and raise from Salary and your salary periods from Earnings (start date, salary, old or new system) to a Google Sheet that only the person who set up your copy of the app can see. Data is stored under a random ID, without your name, and is sent again only when it changes. Nothing else is sent: no vacations, tax settings or rates. "Exactly what is sent" in Settings & data shows the data as it will be sent. Turning participation off there deletes your row.

The requests go through Google, so Google sees them. The endpoint is public, so anyone could send made-up data to it. Treat the collected numbers as rough.

The address the data goes to is written in the app's files (`src/js/stats.js`), and anyone who passes the app on can change it to their own. Take part only if you got the app from a source you trust. The page shows the same warning.

To set up collection: create a Google Sheet, open Extensions → Apps Script, paste `tools/stats-apps-script.gs`, and deploy it as a web app (execute as you, access: anyone). Then put the `/exec` URL into a file named `stats_url.txt` next to `predictor.html` and run `python make_zip.py`. It writes `dist/SalaryPredictor-<date>.zip` with the URL filled into the archive's copy of `src/js/stats.js`; that zip is what you hand out. `stats_url.txt` and `dist/` are in `.gitignore`, and `STATS_URL` in the repository stays empty, so the URL isn't published with the code. `--stats-url <url>` passes the URL directly, `--no-stats` builds an archive with statistics off, and `--with-sources` adds `data/`, `update_data.py` and this README for people who want to update the data themselves. With `STATS_URL` empty the feature is hidden.

Keeping the URL out of the repository only keeps it from being public. Everyone who gets the zip can still read it.

## Development

Markup is in `predictor.html`, styles in `src/styles.css`, code in `src/js/`, one file per area. There is no build step: edit and reload. See `AGENTS.md` for the file map and conventions.

---

# Прогноз курса компании

Прогнозирует месячный курс USD→RUB компании по дневным курсам ЦБ.

## Как пользоваться

Откройте `predictor.html` двойным щелчком. Он работает в любом браузере без установки, но папка `src` должна лежать рядом с ним. В боковом меню пять разделов:

- Прогноз курса: прогноз курса компании на текущий месяц с вероятным диапазоном, поле для ожидаемого курса ЦБ до конца месяца (по умолчанию последний курс), график и таблица сравнения модели с прошлыми курсами компании. Завершённые месяцы, для которых курса компании ещё нет, показываются со средним курсом ЦБ и оценкой модели. Под таблицей можно ввести курс компании за месяц, когда он станет известен; он сохраняется в браузере, а «Скачать CSV с курсами компании» даёт полный список для `data/company_rates.csv`
- Зарплата: калькулятор зарплаты, описанный ниже
- История зарплаты: какой была бы зарплата в прошлые месяцы
- Выплаты: все выплаты за год с датами, отпускными и календарём
- Настройки и данные: настройки модели, налог, загрузка CSV, статистика зарплат и описание расчёта

Открытый раздел запоминается в адресной строке (`predictor.html#salary`), его можно добавить в закладки.

При открытии страница подгружает новые курсы ЦБ с cbr-xml-daily.ru (публичное зеркало данных ЦБ). Без интернета используются курсы из `src/data.js`.

## Зарплата

Раздел «Зарплата» считает оплату по схеме с привязкой к курсу. Фиксированная доля текущей зарплаты X выплачивается как есть. Остаток умножается на Y, который зависит от курса компании: Y = 0 на нижней границе, 1 на базовом курсе и не больше максимального Y. Параметры схемы задаются в разделе «Зарплата». Значения по умолчанию только пример (фиксированная доля 0,5, нижняя граница 50 ₽, база 80 ₽, верхняя граница 100 ₽, максимальный Y 2), введите свои. Курс берётся из раздела «Прогноз курса», можно ввести свой.

Y между границами считается одним из двух способов:

- Два отрезка: одна прямая от нижней границы до базы, другая от базы до верхней границы (100 ₽ → 2). Каждая граница даёт ровно свой Y.
- Одна прямая: через нижнюю границу и базу (1/30 ≈ 0,033 за рубль при значениях по умолчанию), с ограничением максимальным Y. Ограничение 2 достигается при 110 ₽, поэтому при 100 ₽ Y равен 1,667.

Поле «Повышение, %» применяет повышение к X до разделения на части. Например, X = 100 000 с повышением на 10% даёт базу 110 000, и при фиксированной доле 0,5 по умолчанию и Y ≈ 1,09 зарплата составит 115 000. Страница показывает общее изменение относительно исходного X (+15%) и раскладывает его на повышение (+10%) и курс (+5%). Ещё она показывает курс безубыточности, то есть курс компании, при котором зарплата с повышением равна текущему X. При настройках по умолчанию и повышении на 10% это 74,55 ₽: ниже этого уровня курс забирает больше, чем даёт повышение. Если курс взят из прогноза, страница пишет, выше или ниже этого уровня диапазон прогноза. Налоги не сдвигают этот курс, поэтому он одинаковый в режимах до и после налога.

Карточка с историей показывает, какой была бы зарплата X в каждом месяце, для которого есть курс компании, по новой системе, по фактическому курсу компании за этот месяц (без повышения). Зелёные столбцы означают месяцы выше X, красные ниже. Там же итоговая и средняя разница за весь период.

Все настройки, зарплата и повышение сохраняются в браузере.

## Выплаты

Раздел «Выплаты» показывает все выплаты за год: когда приходят деньги и сколько.

- Зарплата выплачивается два раза в месяц. 25-го приходит аванс за рабочие дни с 1-го по 15-е: месячная зарплата × эти дни ÷ рабочие дни месяца. 10-го числа следующего месяца приходит остаток за месяц. Если дата выпадает на выходной или праздник, деньги приходят в последний рабочий день перед ней, даже если это предыдущий месяц или год (10 января 2027 года выплачивается 30 декабря 2026 года и считается в 2026 году).
- По новой системе аванс считается только от фиксированной доли. Часть от курса приходит вместе с остатком 10-го, по курсу компании за этот месяц. Для месяцев без курса компании берётся прогноз: по уже опубликованным курсам ЦБ, а для будущих месяцев прогноз текущего месяца.
- Периоды зарплаты описывают, что и когда платили: с какой даты, месячная зарплата, старая или новая система. Период действует до начала следующего. Если смена приходится на середину месяца, месяц делится по рабочим дням. Новая система использует фиксированную долю и множитель из раздела «Зарплата»; поле «Повышение» оттуда здесь не используется.
- Дни отпуска не оплачиваются как зарплата. Отпускные приходят в последний рабочий день перед отпуском: средний дневной заработок × дни отпуска, где выходные считаются, а праздники нет. Средний дневной заработок считается по Трудовому кодексу: зарплата за 12 полных месяцев до месяца отпуска ÷ дни, где полностью отработанный месяц считается за 29,3 дня, а месяц с отпуском за 29,3 × дни вне отпуска ÷ дни месяца.
- Вместо отпуска можно указать тип «Компенсация»: вы продолжаете работать и получаете зарплату как обычно, а сверх неё такие же отпускные за эти дни, посчитанные так же и выплаченные в тот же день (последний рабочий день перед первым днём). Дни компенсации не исключаются из среднего заработка для следующих отпусков, а выходные внутри них можно отметить как отработанные. Компенсация не может пересекаться с отпуском.
- Работа в выходной или праздник оплачивается по двойной дневной ставке своего месяца (месячная зарплата ÷ рабочие дни × 2; по новой системе с множителем Y, как остальная зарплата). Выплачивается как зарплата, по дате дня: дни с 1-го по 15-е с авансом 25-го (по новой системе только фиксированная доля, часть от курса 10-го), более поздние дни 10-го числа следующего месяца. В авансе такой день с 1-го по 15-е ещё и считается отработанным, поэтому 25-го приходит на один день зарплаты больше, а 10-го на столько же меньше; итог за месяц не меняется. Например, в мае 2025 года (18 рабочих дней) при работе 1, 2, 8 и 9 мая и зарплате 150 000 ₽ аванс 23 мая составит 19/18 зарплаты, 158 333 ₽ (137 750 ₽ после налога 13%), а остаток 10 июня 7/18, 58 333 ₽ (50 750 ₽ после налога). Эти суммы учитываются в заработке для расчёта отпускных. Добавьте такие дни в блоке «Работа в выходные и праздники» или щёлкните по выходному в календаре; дата, которая приходится на рабочий день, на отпуск или раньше первого периода зарплаты, показывается красным и не учитывается.
- Если учёт налога включён, налог удерживается с каждой выплаты нарастающим итогом с начала года по дате выплаты, и в разделе появляется переключатель «До налога / После налога».

Ещё в разделе есть календарь года с рабочими днями, выходными, праздниками, отпусками, отработанными выходными и днями выплат, и количество дней за год.

Под каждым месяцем календарь показывает, сколько заработано за этот месяц, когда бы ни пришли деньги: зарплата за месяц (аванс 25-го плюс остаток 10-го числа следующего месяца, вместе с отработанными выходными) и отпускные или компенсация за дни, которые приходятся на этот месяц. При наведении видно, из чего состоит сумма. Отпускные делятся по дням, поэтому отпуск с 28 января по 10 февраля считается частично в январе и частично в феврале, хотя выплачен в январе. После налога каждая часть считается с налогом той выплаты, с которой пришла. Итог за работу в году показан над списком выплат; он отличается от «Выплаты за год», потому что остаток за декабрь приходит в январе, а отпускные могут прийти в предыдущем месяце.

Отпуска можно вводить по одному или загрузить из CSV с первым и последним днём в каждой строке и, если нужно, типом (`2026-08-10;2026-08-23` или `2026-08-10;2026-08-23;compensation`; без типа это отпуск; одна дата означает отпуск на один день; разделителем может быть и запятая). Загрузка файла заменяет список. «Скачать шаблон отпусков» даёт CSV с текущими отпусками или только с заголовком, если отпусков нет: заполните его и загрузите обратно.

Производственный календарь России на 2024–2027 годы встроен (`data/holidays.csv`, его встраивает `update_data.py`). «Загрузить с xmlcalendar.ru» скачивает календари на годы из списка лет (от самых ранних данных до следующего года) из репозитория данных xmlcalendar.ru на GitHub; ещё не опубликованные годы перечисляются в строке статуса. Сам сайт xmlcalendar.ru страница прочитать не может, потому что он не разрешает запросы с других страниц. «Скачать шаблон на <год>» даёт календарь выбранного года в CSV, чтобы его поправить и загрузить обратно. Скачанный или загруженный год заменяет этот год встроенного календаря; «Вернуть встроенный календарь» отменяет все такие замены. Форматы файлов:

- CSV со строками `дата;тип` (или `дата,тип`), тип `holiday` (праздник), `dayoff` (нерабочий будний день) или `workday` (рабочая суббота или воскресенье). Остальные дни считаются по схеме понедельник–пятница.
- Официальный CSV производственного календаря с data.gov.ru: строка на год, столбец на месяц со списком выходных (`*` сокращённый день, `+` перенесённый выходной).
- XML с xmlcalendar.ru (`https://xmlcalendar.ru/data/ru/<год>/calendar.xml`).

Для года без календаря выходными считаются только суббота, воскресенье и праздники из статьи 112 Трудового кодекса.

Периоды зарплаты, отпуска, отработанные выходные и загруженные или скачанные календари сохраняются в браузере.

## Налог на доходы

По умолчанию налог не учитывается. Включите «Учитывать налог на доходы» в разделе «Настройки и данные». X всегда вводится до вычета налога. В разделах «Зарплата», «История зарплаты» и «Выплаты» появляется переключатель «До налога / После налога». Все эти переключатели управляют одной настройкой.

Ставки задаются диапазонами годового дохода. Каждая ставка действует только на часть дохода за год внутри своего диапазона. По умолчанию это НДФЛ 2025: 13% до 2,4 млн ₽, 15% до 5 млн, 18% до 20 млн, 20% до 50 млн, 22% свыше. Диапазоны можно менять, добавлять, удалять или вернуть к исходным.

Налог удерживается нарастающим итогом с начала года, как НДФЛ. Налог за месяц равен налогу со всего дохода с января минус уже удержанное. При X = 300 000 первые восемь месяцев дают по 261 000 ₽ на руки. Сентябрь первый месяц после того, как доход превысил 2,4 млн, поэтому он даёт 255 000 ₽. В истории прошлые месяцы того же года берутся с их фактической зарплатой (месяцы без курса компании считаются как X). После налога каждый месяц сравнивается с тем, что осталось бы от X в том же месяце, поэтому пунктирная линия X опускается ступенькой, когда X переходит в следующий диапазон. В разделе «Зарплата» повышение учитывается начиная с выбранного месяца.

## Как считается

Курс компании следует за средним курсом ЦБ за тот же календарный месяц, умноженным на коэффициент `k`. Приложение:

1. усредняет уже опубликованные в этом месяце курсы ЦБ,
2. заполняет оставшиеся дни публикации (вторник–суббота) ожидаемым курсом,
3. умножает результат на `k`, медиану отношения курса компании к среднему ЦБ за последние 12 месяцев.

Проверка на истории показывает, насколько ошибались прошлые прогнозы. В начале месяца ошибка больше, потому что большая часть курсов ещё неизвестна.

В репозитории нет курсов компании (в `data/company_rates.csv` только заголовок), поэтому новая копия не может прогнозировать, пока их нет. Вводите курс компании за каждый месяц под таблицей истории или загрузите CSV в разделе «Настройки и данные». И то и другое сохраняется в браузере.

## Обновление данных

Курсы компании не хранятся в репозитории. Положите их в `private/company_rates.csv` (`private/` указана в `.gitignore`) и каждый месяц добавляйте строку:

```
1,01.10.2026,84.10,Доллар США
```

Затем запустите (Python 3.8+, ничего устанавливать не нужно):

```
python update_data.py
```

Скрипт докачает недостающие курсы с cbr.ru в `data/cbr_usd.csv`, пересоберёт `src/data.js` из CSV-файлов в `data/` (то есть без курсов компании) и выведет текущий прогноз по `private/company_rates.csv`, если он есть. Для раздачи запустите `python make_zip.py`. В собранном архиве `src/data.js` содержит курсы из `private/company_rates.csv`, а параметры схемы по умолчанию берутся из `private/scheme.json` (например `{"fixed": "0.5", "lower": "50", "base": "80", "upper": "100", "yMin": "0", "yMax": "2"}`, with your own numbers). В самом репозитории нет ни того, ни другого.

Параметры:

- `--no-fetch`: только пересобрать `src/data.js` без интернета
- `--month 2026-10 --expected 85.5`: прогноз для месяца и ожидаемого курса
- `--months 24`: сколько прошлых месяцев использовать для `k` (0 означает все)

Без Python загрузите CSV через раздел «Данные» на странице. Загруженные данные сохраняются только в этом браузере.

Формат CSV: `nominal,date,curs,cdx`. Даты в формате `M/D/YYYY` (как в `cbr_usd.csv`), `DD.MM.YYYY` или `YYYY-MM-DD`. Разделитель: запятая или точка с запятой.

## Статистика зарплат

По желанию и только с вашего согласия. Если в вашей копии включена статистика, при первом открытии страница спросит, хотите ли вы участвовать. Если вы согласитесь, она отправит текущую зарплату и повышение из раздела «Зарплата» и периоды зарплаты из раздела «Выплаты» (дата начала, зарплата, старая или новая система) в Google-таблицу, которую видит только тот, кто настроил вашу копию приложения. Данные хранятся под случайным идентификатором, без имени, и отправляются повторно только при изменении. Больше ничего не отправляется: ни отпуска, ни настройки налога, ни курсы. В разделе «Настройки и данные» пункт «Что именно отправляется» показывает данные в том виде, в каком они будут отправлены. Если там отключить участие, ваша строка удаляется.

Запросы идут через Google, поэтому Google их видит. Адрес приёма публичный, и кто угодно может отправить на него выдуманные данные. Считайте собранные цифры приблизительными.

Адрес, на который отправляются данные, записан в файлах приложения (`src/js/stats.js`), и любой, кто передаёт приложение дальше, может заменить его своим. Участвуйте, только если получили приложение из источника, которому доверяете. Страница показывает такое же предупреждение.

Настройка сбора: создайте Google-таблицу, откройте «Расширения → Apps Script», вставьте `tools/stats-apps-script.gs` и разверните его как веб-приложение (запуск от вашего имени, доступ: все). Затем запишите URL `/exec` в файл `stats_url.txt` рядом с `predictor.html` и запустите `python make_zip.py`. Скрипт создаст `dist/SalaryPredictor-<дата>.zip`, в котором URL подставлен в копию `src/js/stats.js`; этот архив и раздаётся. `stats_url.txt` и `dist/` указаны в `.gitignore`, а `STATS_URL` в репозитории остаётся пустым, поэтому URL не публикуется вместе с кодом. `--stats-url <url>` передаёт URL напрямую, `--no-stats` собирает архив без статистики, а `--with-sources` добавляет `data/`, `update_data.py` и этот README для тех, кто хочет обновлять данные сам. Если `STATS_URL` пустой, функция скрыта.

URL не попадает в репозиторий, но это защищает только от публикации: любой, кто получил архив, может его прочитать.

## Разработка

Разметка в `predictor.html`, стили в `src/styles.css`, код в `src/js/`, по файлу на каждую часть. Сборки нет: правите и перезагружаете страницу. Карта файлов и правила описаны в `AGENTS.md`.
