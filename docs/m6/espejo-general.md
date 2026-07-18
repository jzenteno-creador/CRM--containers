# Espejo GENERAL — todas las operaciones del sistema (2.959)

Generado 2026-07-18 desde el schema `crm` (proyecto `cctuowthpnstvdgjuomq`). Fechas en zona AR. Orden: fecha retiro asc.

```sql
select c.numero_contenedor, n.nombre naviera, p.nombre planta, o.retiro_de,
 (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date retiro,
 (o.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date devolucion,
 o.estado, o.tipo_cierre, o.estado_carga, k.costo_realizado
from crm.operaciones o
join crm.contenedores c on c.id=o.contenedor_id
join crm.navieras n on n.id=c.naviera_id
left join crm.plantas p on p.id=o.planta_actual_id
left join crm.vista_kpi_costos_cerradas k on k.operacion_id=o.id
order by retiro, c.numero_contenedor;
```

| # | Contenedor | Naviera | Planta | Retiro de | Retiro | Devolución | Estado | Cierre | Carga | Costo USD |
|--:|---|---|---|---|---|---|---|---|---|--:|
| 1 | HASU4904147 | MAERSK | BAHIA | TERMINAL 4 | 2025-05-12 | 2025-09-11 | cerrado | devuelto_vacio | vacio | 3,815 |
| 2 | SUDU6729339 | MAERSK | BAHIA | TERMINAL 4 | 2025-06-04 | 2025-09-11 | cerrado | devuelto_vacio | vacio | 3,010 |
| 3 | TRHU8453867 | CMA CGM | BAHIA | PTN | 2025-07-03 | 2025-08-12 | cerrado | embarcado | lleno | 675 |
| 4 | CMAU8425080 | CMA CGM | BAHIA | TRP | 2025-07-05 | 2025-08-06 | cerrado | embarcado | lleno | 475 |
| 5 | SEGU4323696 | CMA CGM | BAHIA | TRP | 2025-07-05 | 2025-08-05 | cerrado | embarcado | lleno | 450 |
| 6 | TGBU5232149 | CMA CGM | BAHIA | TRP | 2025-07-05 | 2025-08-05 | cerrado | embarcado | lleno | 450 |
| 7 | TCNU3517944 | CMA CGM | BAHIA | PTN | 2025-07-07 | 2025-08-06 | cerrado | devuelto_vacio | vacio | 425 |
| 8 | MSKU8696734 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-10 | 2025-09-11 | cerrado | devuelto_vacio | vacio | 1,750 |
| 9 | MSKU0673732 | MAERSK | BAHIA | PTN | 2025-07-12 | 2025-08-11 | cerrado | embarcado | lleno | 595 |
| 10 | CAAU6672510 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-21 | 2025-08-11 | cerrado | embarcado | lleno | 280 |
| 11 | MRKU3259719 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-21 | 2025-08-11 | cerrado | embarcado | lleno | 280 |
| 12 | TCLU5892700 | MAERSK | BAHIA | TERMINAL 4/ABBOTT | 2025-07-21 | 2025-10-08 | cerrado | devuelto_vacio | vacio | 2,310 |
| 13 | FFAU5575660 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-23 | 2025-08-11 | cerrado | embarcado | lleno | 210 |
| 14 | MIEU0035778 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-23 | 2025-08-11 | cerrado | embarcado | lleno | 210 |
| 15 | MRSU4092969 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-23 | 2025-08-18 | cerrado | embarcado | lleno | 455 |
| 16 | MSKU9424129 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-23 | 2025-08-11 | cerrado | embarcado | lleno | 210 |
| 17 | CAAU6779854 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-18 | cerrado | embarcado | lleno | 280 |
| 18 | CAAU7070837 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 19 | CAAU7253988 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-22 | cerrado | embarcado | lleno | 420 |
| 20 | CAAU9530398 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 21 | CMAU4571445 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 22 | CMAU5849870 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 23 | CMAU6922050 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 24 | CMAU9170110 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 25 | CRSU9370980 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 26 | FFAU4174235 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 27 | GCXU5872293 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-11 | cerrado | embarcado | lleno | 25 |
| 28 | HASU4682245 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 29 | MRKU2961865 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-18 | cerrado | embarcado | lleno | 280 |
| 30 | MRKU4569262 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 31 | MRKU6235583 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 32 | MRSU5292426 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-11 | cerrado | embarcado | lleno | 35 |
| 33 | MRSU5385956 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-22 | cerrado | embarcado | lleno | 420 |
| 34 | MRSU6005285 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 35 | MRSU6916506 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 36 | MRSU6977137 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-22 | cerrado | embarcado | lleno | 420 |
| 37 | MRSU7072396 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 38 | MRSU7860757 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-11 | cerrado | embarcado | lleno | 35 |
| 39 | MSKU1236357 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-11 | cerrado | embarcado | lleno | 35 |
| 40 | MSKU1614138 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-11 | cerrado | embarcado | lleno | 35 |
| 41 | SEKU6048284 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 42 | TCKU6247766 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 43 | TCLU1700162 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-22 | cerrado | embarcado | lleno | 420 |
| 44 | TCNU1762351 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-11 | cerrado | embarcado | lleno | 25 |
| 45 | TCNU2194180 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-13 | cerrado | embarcado | lleno | 75 |
| 46 | TCNU3197178 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-25 | cerrado | embarcado | lleno | 525 |
| 47 | TIIU5567054 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-28 | 2025-08-22 | cerrado | embarcado | lleno | 420 |
| 48 | TLLU8890993 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 49 | TRHU8560886 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 50 | TXGU6683176 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 51 | UETU7434417 | CMA CGM | BAHIA | PTN | 2025-07-28 | 2025-08-18 | cerrado | embarcado | lleno | 200 |
| 52 | CAIU8680293 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 53 | CAIU9124560 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 54 | CMAU3434535 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 55 | CMAU4663433 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 56 | CMAU5772737 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 57 | CMAU5971739 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 58 | CMAU9271306 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 59 | ECMU7498989 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 60 | GESU6700449 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 61 | HAMU3020279 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-07-29 | 2025-08-15 | cerrado | embarcado | lleno | 100 |
| 62 | HLXU8558177 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-07-29 | 2025-08-15 | cerrado | embarcado | lleno | 100 |
| 63 | TCKU6318155 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 64 | TCLU1886838 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 65 | TCLU6481940 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 66 | TCLU9604123 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 67 | TCNU5848303 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 68 | TEMU6843332 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-07-29 | 2025-08-15 | cerrado | embarcado | lleno | 100 |
| 69 | TEMU7620816 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 70 | TRHU4965211 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-07-29 | 2025-08-15 | cerrado | embarcado | lleno | 100 |
| 71 | TRHU6043360 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 72 | UETU7635920 | CMA CGM | BAHIA | PTN | 2025-07-29 | 2025-08-05 | cerrado | embarcado | lleno | 0 |
| 73 | APHU7373851 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-13 | cerrado | embarcado | lleno | 25 |
| 74 | CAAU7565395 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-09-02 | cerrado | embarcado | lleno | 735 |
| 75 | CIPU5064480 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-09-02 | cerrado | embarcado | lleno | 735 |
| 76 | CMAU4682496 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-18 | cerrado | embarcado | lleno | 150 |
| 77 | CMAU6623240 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-13 | cerrado | embarcado | lleno | 25 |
| 78 | CMAU8556449 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 79 | CMAU8807605 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-13 | cerrado | embarcado | lleno | 25 |
| 80 | CMAU9154911 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 81 | CMAU9525484 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-06 | cerrado | devuelto_vacio | vacio | 0 |
| 82 | CXDU1657270 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 83 | GCXU5575459 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 84 | MRKU2699816 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-09-02 | cerrado | embarcado | lleno | 735 |
| 85 | MRSU3600962 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 86 | MRSU5311531 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 87 | MRSU5490397 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 88 | MSKU0983321 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 89 | SUDU8523882 | MAERSK | ABBOTT | HUXLEY | 2025-07-30 | 2025-08-08 | cerrado | embarcado | lleno | 0 |
| 90 | SUDU8880637 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 91 | TCKU6253291 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 92 | TCKU7060574 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-04 | cerrado | embarcado | lleno | 0 |
| 93 | TEMU6560780 | CMA CGM | BAHIA | PTN | 2025-07-30 | 2025-08-06 | cerrado | devuelto_vacio | vacio | 0 |
| 94 | TRHU7490742 | MAERSK | BAHIA | TERMINAL 4 | 2025-07-30 | 2025-08-29 | cerrado | embarcado | lleno | 595 |
| 95 | APHU7402250 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-20 | cerrado | devuelto_vacio | vacio | 75 |
| 96 | BMOU5550629 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 97 | CMAU4414282 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 98 | CMAU9167035 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 99 | CMAU9310927 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 100 | DFSU6829625 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-19 | cerrado | embarcado | lleno | 50 |
| 101 | GCXU6124850 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-06 | cerrado | embarcado | lleno | 0 |
| 102 | SEGU4117838 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 103 | SEGU4400806 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 104 | SEKU6090221 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 105 | TCNU6553565 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 106 | TEMU8435005 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 107 | TGBU5828138 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 108 | TGHU9512284 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 109 | TRHU7155852 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 110 | UETU5468716 | CMA CGM | BAHIA | PTN | 2025-08-04 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 111 | CMAU4477911 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 112 | CMAU6350464 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 113 | CMAU9417601 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 114 | FCIU8753633 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 115 | FSCU7140343 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 116 | FSCU8995981 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 117 | MSKU1578940 | MAERSK | ABBOTT | HUXLEY | 2025-08-05 | 2025-08-08 | cerrado | embarcado | lleno | 0 |
| 118 | SEGU4315303 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 119 | SEGU6429671 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 120 | TCKU6341704 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 121 | TCLU6614806 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 122 | TCNU2603518 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 123 | TCNU7647205 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 124 | TEMU8226999 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 125 | TLLU5108864 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 126 | TXGU6938908 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 127 | UETU7311515 | CMA CGM | BAHIA | PTN | 2025-08-05 | 2025-08-12 | cerrado | embarcado | lleno | 0 |
| 128 | CMAU6123692 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 129 | CMAU8535195 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 130 | CMAU8769697 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 131 | SEGU4964215 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 132 | TCKU6233253 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 133 | TCNU4462091 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 134 | TLLU4579643 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-11 | cerrado | embarcado | lleno | 0 |
| 135 | TRHU7886590 | CMA CGM | BAHIA | PTN | 2025-08-06 | 2025-08-13 | cerrado | embarcado | lleno | 0 |
| 136 | FFAU5773156 | MAERSK | ABBOTT | HUXLEY | 2025-08-08 | 2025-08-15 | cerrado | embarcado | lleno | 0 |
| 137 | TRHU4443500 | MAERSK | ABBOTT | HUXLEY | 2025-08-08 | 2025-08-15 | cerrado | embarcado | lleno | 0 |
| 138 | FSCU8291278 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 139 | GESU6232970 | MAERSK | ABBOTT | DEFIBE | 2025-08-11 | 2025-08-15 | cerrado | embarcado | lleno | 0 |
| 140 | HASU4234019 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-29 | cerrado | embarcado | lleno | 175 |
| 141 | MRKU2284194 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-29 | cerrado | embarcado | lleno | 175 |
| 142 | MRKU2306903 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-09-05 | cerrado | embarcado | lleno | 420 |
| 143 | MRKU3884697 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-28 | cerrado | embarcado | lleno | 140 |
| 144 | MRKU4152664 | MAERSK | ABBOTT | DEFIBE | 2025-08-11 | 2025-08-15 | cerrado | embarcado | lleno | 0 |
| 145 | MRKU5089289 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-29 | cerrado | embarcado | lleno | 175 |
| 146 | MRKU6151883 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-28 | cerrado | embarcado | lleno | 140 |
| 147 | MRSU4284508 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-09-05 | cerrado | embarcado | lleno | 420 |
| 148 | MRSU6475592 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-28 | cerrado | embarcado | lleno | 140 |
| 149 | MVIU0009277 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-11 | 2025-08-29 | cerrado | embarcado | lleno | 175 |
| 150 | BEAU4096688 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-09-01 | cerrado | embarcado | lleno | 175 |
| 151 | CMAU3598842 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 152 | CMAU3900470 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 153 | CMAU6975723 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-09-01 | cerrado | embarcado | lleno | 175 |
| 154 | CMAU7094095 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 155 | CMAU7326740 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 156 | FCIU9343340 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 157 | GCXU5316545 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 158 | GCXU6090452 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-09-01 | cerrado | embarcado | lleno | 175 |
| 159 | GLDU7252582 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-09-01 | cerrado | embarcado | lleno | 175 |
| 160 | SEGU6277497 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 161 | TCLU6567140 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 162 | TCNU6213170 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 163 | TCNU7622742 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 164 | TLLU4726214 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 165 | UETU6581671 | CMA CGM | BAHIA | PTN | 2025-08-12 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 166 | BEAU5227653 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 167 | BMOU6721900 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 168 | CAAU6256998 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 169 | CAIU7115580 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-01 | cerrado | embarcado | lleno | 150 |
| 170 | CAIU9150174 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 171 | CMAU5120240 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 172 | CMAU5617999 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 173 | CMAU5732971 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 174 | CMAU5991798 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-01 | cerrado | embarcado | lleno | 150 |
| 175 | CMAU6167622 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 176 | CMAU7417979 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 177 | CMAU8561300 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-01 | cerrado | embarcado | lleno | 150 |
| 178 | CMAU9455406 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 179 | ECMU4814390 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 180 | GESU6195286 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 181 | MRKU9877381 | MAERSK | ABBOTT | HUXLEY | 2025-08-13 | 2025-08-15 | cerrado | embarcado | lleno | 0 |
| 182 | SEGU4631976 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-15 | cerrado | embarcado | lleno | 500 |
| 183 | SEGU5256170 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-01 | cerrado | embarcado | lleno | 150 |
| 184 | SEGU6375410 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-01 | cerrado | embarcado | lleno | 150 |
| 185 | TEMU6526981 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 186 | TIIU4335100 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 187 | TLLU4010488 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 188 | TRHU5119291 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-09-01 | cerrado | embarcado | lleno | 150 |
| 189 | TRHU6016317 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 190 | TRLU7334265 | CMA CGM | BAHIA | PTN | 2025-08-13 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 191 | CMAU3606188 | CMA CGM | BAHIA | PTN | 2025-08-15 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 192 | CMAU3698332 | CMA CGM | BAHIA | PTN | 2025-08-15 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 193 | CMAU4194758 | CMA CGM | BAHIA | PTN | 2025-08-15 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 194 | CMAU7407923 | CMA CGM | BAHIA | PTN | 2025-08-15 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 195 | GESU6480386 | CMA CGM | BAHIA | PTN | 2025-08-15 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 196 | CAAU7652735 | CMA CGM | BAHIA | PTN | 2025-08-18 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 197 | CIPU5224551 | MAERSK | ABBOTT | HUXLEY | 2025-08-18 | 2025-08-20 | cerrado | embarcado | lleno | 0 |
| 198 | FANU1627861 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-18 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 199 | FFAU4468688 | CMA CGM | BAHIA | PTN | 2025-08-18 | 2025-08-19 | cerrado | embarcado | lleno | 0 |
| 200 | HLBU3265456 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-18 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 201 | HLXU8620479 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-18 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 202 | TCNU3038556 | CMA CGM | BAHIA | PTN | 2025-08-18 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 203 | TEMU7610905 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-18 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 204 | TLLU4335170 | CMA CGM | BAHIA | PTN | 2025-08-18 | 2025-08-18 | cerrado | embarcado | lleno | 0 |
| 205 | TLLU5915510 | MAERSK | ABBOTT | HUXLEY | 2025-08-18 | 2025-08-20 | cerrado | embarcado | lleno | 0 |
| 206 | TLLU5987980 | MAERSK | ABBOTT | HUXLEY | 2025-08-18 | 2025-08-20 | cerrado | embarcado | lleno | 0 |
| 207 | TLLU7749614 | CMA CGM | BAHIA | PTN | 2025-08-18 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 208 | CAAU7779674 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 209 | CAIU4517971 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 210 | CMAU5867318 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-08-27 | cerrado | embarcado | lleno | 0 |
| 211 | CMAU9400656 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-08-22 | cerrado | embarcado | lleno | 0 |
| 212 | CXDU1675946 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 213 | FANU3089549 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 214 | HAMU1447214 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 215 | HAMU2658994 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 216 | HAMU4343281 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 217 | HAMU4349269 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 218 | HLBU1925946 | HAPAG LLOYD | BAHIA | PTN | 2025-08-19 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 219 | MRKU4524397 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-19 | 2025-09-09 | cerrado | embarcado | lleno | 280 |
| 220 | MRSU3191289 | MAERSK | ABBOTT | HUXLEY | 2025-08-19 | 2025-08-20 | cerrado | embarcado | lleno | 0 |
| 221 | MRSU4840459 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-19 | 2025-09-09 | cerrado | embarcado | lleno | 280 |
| 222 | MSKU1379743 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-19 | 2025-09-09 | cerrado | embarcado | lleno | 280 |
| 223 | SEKU6329677 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 224 | TCKU7319958 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-08-27 | cerrado | embarcado | lleno | 0 |
| 225 | TCKU7900216 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-08-27 | cerrado | embarcado | lleno | 0 |
| 226 | TCLU6565620 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 227 | TCNU1234863 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 228 | TCNU6129182 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-08-27 | cerrado | embarcado | lleno | 0 |
| 229 | TLLU4729506 | CMA CGM | BAHIA | PTN | 2025-08-19 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 230 | CRSU9232981 | MAERSK | BAHIA | PTN | 2025-08-22 | 2025-09-05 | cerrado | embarcado | lleno | 35 |
| 231 | HASU4025390 | MAERSK | BAHIA | PTN | 2025-08-22 | 2025-09-05 | cerrado | embarcado | lleno | 35 |
| 232 | MRKU4440070 | MAERSK | BAHIA | PTN | 2025-08-22 | 2025-09-05 | cerrado | embarcado | lleno | 35 |
| 233 | MRSU4176951 | MAERSK | BAHIA | PTN | 2025-08-22 | 2025-09-05 | cerrado | embarcado | lleno | 35 |
| 234 | MRSU5325160 | MAERSK | BAHIA | PTN | 2025-08-22 | 2025-09-05 | cerrado | embarcado | lleno | 35 |
| 235 | SUDU5942904 | MAERSK | BAHIA | PTN | 2025-08-22 | 2025-09-05 | cerrado | embarcado | lleno | 35 |
| 236 | MRKU3783578 | MAERSK | BAHIA | PTN | 2025-08-25 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 237 | MRKU3916942 | MAERSK | BAHIA | PTN | 2025-08-25 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 238 | SUDU8508677 | MAERSK | BAHIA | PTN | 2025-08-25 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 239 | TCNU2253050 | MAERSK | BAHIA | PTN | 2025-08-25 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 240 | FFAU5194982 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-26 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 241 | MRSU3159564 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-26 | 2025-09-16 | cerrado | embarcado | lleno | 280 |
| 242 | MRSU7210659 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-26 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 243 | MRSU8716600 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-26 | 2025-09-12 | cerrado | embarcado | lleno | 140 |
| 244 | MSKU0926358 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-26 | 2025-09-16 | cerrado | embarcado | lleno | 280 |
| 245 | MSKU9594526 | MAERSK | BAHIA | TERMINAL 4 | 2025-08-26 | 2025-09-30 | cerrado | embarcado | lleno | 770 |
| 246 | APHU7247684 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 247 | BMOU5814001 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 248 | BSIU8067137 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 249 | CAIU7115050 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 250 | CMAU3527772 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 251 | CMAU3778654 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 252 | CMAU4707892 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-09 | cerrado | devuelto_vacio | vacio | 0 |
| 253 | CMAU6645296 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 254 | CMAU7573502 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 255 | CMAU7632307 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 256 | CMAU8577776 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 257 | CMAU8627861 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 258 | CMAU8879077 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 259 | DFSU6692738 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-09 | cerrado | devuelto_vacio | vacio | 0 |
| 260 | ECMU7292637 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 261 | ECMU7705258 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 262 | FFAU4294523 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 263 | FFAU4477587 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-01 | cerrado | embarcado | lleno | 0 |
| 264 | FFAU4559155 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 265 | GCXU5855249 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-12 | cerrado | embarcado | lleno | 75 |
| 266 | GCXU5867996 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-11 | cerrado | embarcado | lleno | 50 |
| 267 | GESU6159571 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 268 | HASU4009677 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 269 | HASU4178276 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 270 | MIEU3001278 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 271 | MRKU3225529 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 272 | MRKU3502069 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 273 | MRKU5944840 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 274 | MRSU5408774 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 275 | SEGU4618228 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 276 | SUDU6977910 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 277 | TCKU6295640 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 278 | TCLU6322152 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 279 | TCNU1667890 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-12 | cerrado | embarcado | lleno | 75 |
| 280 | TCNU3838013 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 281 | TCNU6491308 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-09 | cerrado | devuelto_vacio | vacio | 0 |
| 282 | TLLU4440730 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 283 | TRHU7611314 | MAERSK | BAHIA | PTN | 2025-08-27 | 2025-08-28 | cerrado | embarcado | lleno | 0 |
| 284 | UETU6175116 | CMA CGM | BAHIA | PTN | 2025-08-27 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 285 | CAAU9354848 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 286 | HASU4584450 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 287 | HASU4846396 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 288 | HASU4936226 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-09-12 | cerrado | embarcado | lleno | 70 |
| 289 | HASU5164214 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 290 | MRSU3645777 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 291 | MRSU3673104 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 292 | MRSU5678450 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 293 | MSKU1153226 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 294 | MSKU1754382 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 295 | TCKU6612149 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 296 | TCKU7510460 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 297 | TCNU3208755 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-09-12 | cerrado | embarcado | lleno | 70 |
| 298 | TGHU6625461 | MAERSK | BAHIA | PTN | 2025-08-28 | 2025-08-29 | cerrado | embarcado | lleno | 0 |
| 299 | BEAU5618302 | CMA CGM | BAHIA | PTN | 2025-08-29 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 300 | CAAU6283479 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 301 | CAAU6613056 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 302 | CAAU7986711 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 303 | CMAU6895269 | CMA CGM | BAHIA | PTN | 2025-08-29 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 304 | CMAU8538907 | CMA CGM | BAHIA | PTN | 2025-08-29 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 305 | FANU1638104 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 306 | FANU1796440 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 307 | FANU3104427 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 308 | FDCU0036282 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-10-17 | cerrado | embarcado | lleno | 900 |
| 309 | FFAU5744250 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-12 | cerrado | embarcado | lleno | 35 |
| 310 | GCXU5667072 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 311 | HAMU1987104 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 312 | HAMU3839620 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-10-06 | cerrado | embarcado | lleno | 625 |
| 313 | HAMU3841989 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 314 | HASU4041220 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-12 | cerrado | embarcado | lleno | 35 |
| 315 | HLBU2781329 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 316 | MRKU4660840 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 317 | MRKU5191330 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 318 | MRSU3106121 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 319 | MRSU4601731 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 320 | MRSU4831858 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-12 | cerrado | embarcado | lleno | 35 |
| 321 | MRSU5626138 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 322 | MRSU6085167 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 323 | MRSU6574126 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-12 | cerrado | embarcado | lleno | 35 |
| 324 | MRSU7058063 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 325 | MSKU1525133 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-12 | cerrado | embarcado | lleno | 35 |
| 326 | MSKU1921710 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 327 | MSKU9375338 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 328 | MSKU9530943 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-16 | cerrado | embarcado | lleno | 175 |
| 329 | SEKU4476787 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-08-30 | cerrado | embarcado | lleno | 0 |
| 330 | TCKU6526164 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 331 | TCLU5639184 | MAERSK | BAHIA | PTN | 2025-08-29 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 332 | TCLU6329521 | CMA CGM | BAHIA | PTN | 2025-08-29 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 333 | TEMU7683671 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 334 | TEMU8855651 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-10-06 | cerrado | embarcado | lleno | 625 |
| 335 | TGBU6067075 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-08-29 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 336 | BMOU6406046 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 337 | BSIU9275120 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 338 | CAIU9703156 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 339 | CMAU3464720 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 340 | CMAU6000023 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 341 | CMAU6226582 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 342 | CMAU6931216 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 343 | ECMU7117423 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-15 | cerrado | embarcado | lleno | 75 |
| 344 | ECMU7168210 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-15 | cerrado | embarcado | lleno | 75 |
| 345 | SEGU6427914 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-15 | cerrado | embarcado | lleno | 75 |
| 346 | TCNU1102846 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 347 | TCNU1770819 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-22 | cerrado | embarcado | lleno | 250 |
| 348 | TGBU6752340 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 349 | TRHU8973112 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 350 | TXGU8731226 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 351 | UETU5527892 | CMA CGM | BAHIA | PTN | 2025-08-30 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 352 | APHU7354276 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 353 | BEAU4025405 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 354 | BEAU4669199 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 355 | BSIU9387710 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 356 | CAAU5696924 | MAERSK | BAHIA | DEFIBE | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 357 | CAAU5965978 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 358 | CAAU8477180 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-01 | 2025-09-30 | cerrado | embarcado | lleno | 560 |
| 359 | CAIU7376861 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 360 | CMAU4662530 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 361 | CMAU8649027 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 362 | ECMU4870460 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-19 | cerrado | embarcado | lleno | 125 |
| 363 | ECMU4932279 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 364 | ECMU7717691 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 365 | FFAU4316793 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 366 | GCXU5310059 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-19 | cerrado | embarcado | lleno | 125 |
| 367 | MRKU3330925 | MAERSK | BAHIA | HUXLEY | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 368 | MRKU4037059 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-01 | 2025-09-30 | cerrado | embarcado | lleno | 560 |
| 369 | MRSU5166330 | MAERSK | BAHIA | DEFIBE | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 370 | MSKU9426749 | MAERSK | BAHIA | HUXLEY | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 371 | PONU8257726 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-01 | 2025-09-30 | cerrado | embarcado | lleno | 560 |
| 372 | SEGU6062781 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 373 | SEKU4330323 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 374 | SEKU6451427 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 375 | TCLU6582798 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 376 | TCNU5724853 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-02 | cerrado | embarcado | lleno | 0 |
| 377 | TGBU5764692 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-22 | cerrado | embarcado | lleno | 200 |
| 378 | TXGU4395801 | CMA CGM | BAHIA | PTN | 2025-09-01 | 2025-09-04 | cerrado | embarcado | lleno | 0 |
| 379 | HASU4195801 | MAERSK | BAHIA | PTN | 2025-09-02 | 2025-09-16 | cerrado | embarcado | lleno | 35 |
| 380 | MRKU3787969 | MAERSK | BAHIA | PTN | 2025-09-02 | 2025-09-30 | cerrado | embarcado | lleno | 525 |
| 381 | MRSU3567397 | MAERSK | BAHIA | PTN | 2025-09-02 | 2025-09-16 | cerrado | embarcado | lleno | 35 |
| 382 | MSKU0609754 | MAERSK | BAHIA | PTN | 2025-09-02 | 2025-09-16 | cerrado | embarcado | lleno | 35 |
| 383 | MSKU8786864 | MAERSK | BAHIA | PTN | 2025-09-02 | 2025-10-15 | cerrado | embarcado | lleno | 1,050 |
| 384 | TLLU5393782 | MAERSK | BAHIA | PTN | 2025-09-02 | 2025-09-18 | cerrado | embarcado | lleno | 105 |
| 385 | CAAU7872880 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 386 | CAAU8385084 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 387 | CAIU7216293 | MAERSK | ABBOTT | HUXLEY | 2025-09-03 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 388 | HASU4668458 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 389 | MRKU3935496 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 390 | MRSU5911710 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 391 | MSKU1377463 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 392 | MSKU1658075 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 393 | MSKU1844850 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 394 | SUDU5951207 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 395 | TRHU7605224 | MAERSK | BAHIA | PTN | 2025-09-03 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 396 | BEAU5974514 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-19 | cerrado | embarcado | lleno | 50 |
| 397 | CAAU6329857 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 398 | CAIU9092740 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 399 | CIPU5281417 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 400 | CMAU5530440 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-19 | cerrado | embarcado | lleno | 50 |
| 401 | CMAU7158477 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 402 | CMAU7973849 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 403 | ECMU7349183 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 404 | ECMU7595700 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 405 | FSCU8771410 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-19 | cerrado | embarcado | lleno | 50 |
| 406 | GESU6465252 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 407 | MRKU5015202 | MAERSK | BAHIA | PTN | 2025-09-04 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 408 | MRKU6287268 | MAERSK | BAHIA | PTN | 2025-09-04 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 409 | MRSU6292502 | MAERSK | BAHIA | PTN | 2025-09-04 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 410 | SEKU6970145 | MAERSK | BAHIA | PTN | 2025-09-04 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 411 | TGBU5287666 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 412 | TRHU7136699 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-05 | cerrado | embarcado | lleno | 0 |
| 413 | TRHU8221218 | CMA CGM | BAHIA | PTN | 2025-09-04 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 414 | BMOU5797563 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 415 | BMOU6097369 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 416 | BMOU6989703 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 417 | CAAU5933374 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 418 | CAAU8316231 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-30 | cerrado | embarcado | lleno | 420 |
| 419 | CAIU8982267 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 420 | CMAU7156279 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 421 | CMAU7421747 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 422 | CMAU9710055 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 423 | ECMU7331815 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 424 | FFAU7192079 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-30 | cerrado | embarcado | lleno | 420 |
| 425 | MRKU3430842 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 426 | MRKU5672531 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 427 | MRSU5080160 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-30 | cerrado | embarcado | lleno | 420 |
| 428 | MRSU7203876 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 429 | MRSU7204065 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 430 | MRSU7519680 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 431 | MSKU0144364 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-30 | cerrado | embarcado | lleno | 420 |
| 432 | MSKU1282115 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 433 | MSKU1901755 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 434 | SUDU6550404 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 435 | SUDU8691886 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-30 | cerrado | embarcado | lleno | 420 |
| 436 | TCKU6424603 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 437 | TCKU6704918 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-05 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 438 | TCLU5047544 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 439 | TCNU6119836 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 440 | TCNU7580945 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 441 | TGHU6603478 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 442 | TLLU4930911 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 443 | TLLU7751777 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 444 | TRHU4805110 | MAERSK | BAHIA | PTN | 2025-09-05 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 445 | TRHU6904067 | CMA CGM | BAHIA | PTN | 2025-09-05 | 2025-09-08 | cerrado | embarcado | lleno | 0 |
| 446 | CAAU7396546 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 447 | CMAU3704395 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 448 | CMAU6482326 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 449 | ECMU7034951 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 450 | ECMU7686420 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-12 | cerrado | embarcado | lleno | 0 |
| 451 | SEGU6324372 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 452 | TLLU4337104 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 453 | TXGU8804209 | CMA CGM | BAHIA | PTN | 2025-09-08 | 2025-09-09 | cerrado | embarcado | lleno | 0 |
| 454 | CMAU6678730 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 455 | CMAU7598286 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 456 | CMAU8612394 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-14 | cerrado | embarcado | lleno | 0 |
| 457 | FCIU8933785 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 458 | FFAU5358108 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 459 | GESU6873470 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 460 | HAMU1859757 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 461 | HAMU2779790 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 462 | HAMU3285236 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 463 | HAMU4077900 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 464 | HAMU4221914 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 465 | HAMU4485624 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 466 | HAMU4600538 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 467 | HAMU4602417 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 468 | SEGU6055740 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 469 | SEKU6380874 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 470 | TCKU6172409 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 471 | TCNU3662304 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 472 | TCNU5888190 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 473 | TGBU5077823 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-29 | cerrado | embarcado | lleno | 175 |
| 474 | TGCU5458567 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 475 | TLLU4430876 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 476 | TRHU6184429 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 477 | TRHU7688785 | CMA CGM | BAHIA | PTN | 2025-09-09 | 2025-09-11 | cerrado | embarcado | lleno | 0 |
| 478 | GAOU6972253 | CMA CGM | BAHIA | PTN | 2025-09-10 | 2025-09-25 | cerrado | embarcado | lleno | 50 |
| 479 | MAGU5437955 | CMA CGM | BAHIA | PTN | 2025-09-10 | 2025-09-26 | cerrado | embarcado | lleno | 75 |
| 480 | TCNU7414651 | CMA CGM | BAHIA | PTN | 2025-09-10 | 2025-09-26 | cerrado | embarcado | lleno | 75 |
| 481 | TEMU6480849 | CMA CGM | BAHIA | PTN | 2025-09-10 | 2025-09-29 | cerrado | embarcado | lleno | 150 |
| 482 | TGBU5282561 | CMA CGM | BAHIA | PTN | 2025-09-10 | 2025-09-25 | cerrado | embarcado | lleno | 50 |
| 483 | UETU7441437 | CMA CGM | BAHIA | PTN | 2025-09-10 | 2025-09-26 | cerrado | embarcado | lleno | 75 |
| 484 | CAAU6434810 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 485 | CAAU7219561 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 486 | GATU8705613 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 487 | HASU4795895 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 488 | MIEU3058437 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-30 | cerrado | embarcado | lleno | 210 |
| 489 | MRKU2460570 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 490 | MRKU3318806 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 491 | MRKU3507501 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 492 | MRKU5928330 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-30 | cerrado | embarcado | lleno | 210 |
| 493 | MRKU5973108 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 494 | MRSU3289640 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 495 | MRSU5947760 | MAERSK | ABBOTT | HUXLEY | 2025-09-11 | 2025-09-24 | cerrado | embarcado | lleno | 0 |
| 496 | MSKU1744229 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-30 | cerrado | embarcado | lleno | 210 |
| 497 | MSKU1801709 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 498 | MSKU1936026 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 499 | SUDU6743553 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 500 | TCLU5453380 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-11 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 501 | TCNU1474524 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-30 | cerrado | embarcado | lleno | 210 |
| 502 | TCNU8249211 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-16 | cerrado | embarcado | lleno | 0 |
| 503 | TEMU7481541 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-10-15 | cerrado | embarcado | lleno | 735 |
| 504 | TLLU5832252 | MAERSK | BAHIA | PTN | 2025-09-11 | 2025-09-30 | cerrado | embarcado | lleno | 210 |
| 505 | CAAU5300611 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-24 | cerrado | embarcado | lleno | 1,015 |
| 506 | CAAU9115289 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-09-29 | cerrado | embarcado | lleno | 140 |
| 507 | CAIU8059394 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-09-29 | cerrado | embarcado | lleno | 140 |
| 508 | CMAU3705051 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 509 | CMAU4387762 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 510 | CMAU7794925 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-15 | cerrado | embarcado | lleno | 0 |
| 511 | CMAU9413606 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-26 | cerrado | embarcado | lleno | 25 |
| 512 | DRYU9913195 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-26 | cerrado | embarcado | lleno | 25 |
| 513 | HASU5083581 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-11-25 | cerrado | embarcado | lleno | 2,135 |
| 514 | INKU6197809 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-11-06 | cerrado | devuelto_vacio | vacio | 1,470 |
| 515 | MRKU2831455 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-21 | cerrado | embarcado | lleno | 910 |
| 516 | MRKU3882478 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-07 | cerrado | embarcado | lleno | 420 |
| 517 | MRKU4310414 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-21 | cerrado | embarcado | lleno | 910 |
| 518 | MRKU4579574 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-27 | cerrado | embarcado | lleno | 1,120 |
| 519 | MRKU4820589 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 520 | MRKU5672254 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 521 | MRKU5866521 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 522 | MRSU3696007 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-29 | cerrado | embarcado | lleno | 1,190 |
| 523 | MRSU3980121 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 524 | MRSU4024497 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-21 | cerrado | embarcado | lleno | 910 |
| 525 | MRSU7061220 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-09-23 | cerrado | embarcado | lleno | 0 |
| 526 | MRSU7697254 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-29 | cerrado | embarcado | lleno | 1,190 |
| 527 | MSKU0218261 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-10 | cerrado | embarcado | lleno | 525 |
| 528 | MSKU0602019 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 529 | MSKU1778511 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 530 | MSKU1798837 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-21 | cerrado | embarcado | lleno | 910 |
| 531 | MSKU9726598 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-29 | cerrado | embarcado | lleno | 1,190 |
| 532 | TCLU6551760 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-26 | cerrado | embarcado | lleno | 25 |
| 533 | TCNU1811538 | MAERSK | BAHIA | PTN | 2025-09-12 | 2025-09-18 | cerrado | embarcado | lleno | 0 |
| 534 | TCNU4756049 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-10-10 | cerrado | embarcado | lleno | 525 |
| 535 | TCNU5669273 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 536 | TEMU6467317 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-26 | cerrado | embarcado | lleno | 25 |
| 537 | TGBU4145630 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-26 | cerrado | embarcado | lleno | 25 |
| 538 | TGBU5292657 | CMA CGM | BAHIA | PTN | 2025-09-12 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 539 | TGBU5395830 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-12 | 2025-09-29 | cerrado | embarcado | lleno | 140 |
| 540 | BEAU5972620 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 541 | CAAU6048802 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-20 | cerrado | embarcado | lleno | 0 |
| 542 | CMAU8684835 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 543 | CMAU9502128 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 544 | ECMU4925686 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 545 | ECMU7452571 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 546 | TCKU7597650 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 547 | TCNU3153821 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 548 | TCNU3604910 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 549 | TGBU5755978 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-10-03 | cerrado | embarcado | lleno | 125 |
| 550 | TLLU4495096 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 551 | TLLU5034421 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 552 | TLLU7676014 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 553 | TRHU6502303 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 554 | TRHU8952784 | CMA CGM | BAHIA | PTN | 2025-09-15 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 555 | MSKU1044420 | MAERSK | ABBOTT | HUXLEY | 2025-09-16 | 2025-09-19 | cerrado | embarcado | lleno | 0 |
| 556 | CAAU6234659 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-01 | cerrado | embarcado | lleno | 35 |
| 557 | CAIU7388121 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 558 | HASU4258999 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-10 | cerrado | embarcado | lleno | 350 |
| 559 | HASU4941346 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-15 | cerrado | embarcado | lleno | 525 |
| 560 | MAGU5137433 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-01 | cerrado | embarcado | lleno | 35 |
| 561 | MRKU2308320 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 562 | MRKU5155884 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-01 | cerrado | embarcado | lleno | 35 |
| 563 | MRSU3073558 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 564 | MRSU3176561 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-10 | cerrado | embarcado | lleno | 350 |
| 565 | MRSU3200879 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-06 | cerrado | embarcado | lleno | 210 |
| 566 | MRSU6452724 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-01 | cerrado | embarcado | lleno | 35 |
| 567 | MRSU7099099 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-06 | cerrado | embarcado | lleno | 210 |
| 568 | MRSU7386782 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 569 | MRSU7465747 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-06 | cerrado | embarcado | lleno | 210 |
| 570 | MRSU7656105 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-15 | cerrado | embarcado | lleno | 525 |
| 571 | MRSU7768337 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-01 | cerrado | embarcado | lleno | 35 |
| 572 | MRSU8053596 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-24 | cerrado | embarcado | lleno | 840 |
| 573 | MSKU1861523 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-10 | cerrado | embarcado | lleno | 350 |
| 574 | MVIU0024939 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-10 | cerrado | embarcado | lleno | 350 |
| 575 | PONU8043067 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-10 | cerrado | embarcado | lleno | 350 |
| 576 | TCKU6433800 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 577 | TCLU8377540 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-11-06 | cerrado | devuelto_vacio | vacio | 1,295 |
| 578 | TCNU4468700 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-10 | cerrado | embarcado | lleno | 350 |
| 579 | TCNU8645491 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-21 | cerrado | embarcado | lleno | 735 |
| 580 | TGHU9772424 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-17 | 2025-10-06 | cerrado | embarcado | lleno | 210 |
| 581 | CAAU9142129 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-15 | cerrado | embarcado | lleno | 490 |
| 582 | CIPU5092795 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 583 | GCXU5527234 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-06 | cerrado | embarcado | lleno | 175 |
| 584 | HASU4882562 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 585 | MRKU2208872 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 586 | MRKU2523853 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-10 | cerrado | embarcado | lleno | 315 |
| 587 | MRKU2879910 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 588 | MRKU3994020 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 589 | MRSU3417967 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-15 | cerrado | embarcado | lleno | 490 |
| 590 | MRSU6214114 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 591 | MRSU7778649 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-10 | cerrado | embarcado | lleno | 315 |
| 592 | MRSU7936019 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 593 | MRSU8391356 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-10 | cerrado | embarcado | lleno | 315 |
| 594 | MSKU0126592 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-15 | cerrado | embarcado | lleno | 490 |
| 595 | MSKU1598504 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-15 | cerrado | embarcado | lleno | 490 |
| 596 | TCKU7570201 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 597 | TRHU6182690 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-18 | 2025-10-10 | cerrado | embarcado | lleno | 315 |
| 598 | CMAU3482889 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 599 | CMAU7300616 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 600 | CMAU7986091 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 601 | ECMU7071425 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 602 | FANU1256293 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 603 | FCIU9317465 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 604 | HAMU1352340 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 605 | HAMU1523335 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 606 | HAMU1526273 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-17 | cerrado | embarcado | lleno | 375 |
| 607 | HAMU1631258 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 608 | HAMU3598288 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 609 | HAMU4336702 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 610 | HAMU4403082 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-23 | cerrado | embarcado | lleno | 525 |
| 611 | HAMU4469449 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 612 | HLBU1957239 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 613 | HLBU3108312 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-06 | cerrado | embarcado | lleno | 100 |
| 614 | HLXU8550896 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-23 | cerrado | embarcado | lleno | 525 |
| 615 | MRKU2740674 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-19 | 2025-10-10 | cerrado | embarcado | lleno | 280 |
| 616 | MRKU2834984 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-19 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 617 | MRSU7203198 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-19 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 618 | SEKU5883494 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 619 | SEKU6347731 | HAPAG LLOYD | BAHIA | PTN | 2025-09-19 | 2025-10-23 | cerrado | embarcado | lleno | 525 |
| 620 | TCNU2618185 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 621 | TEMU6545889 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 622 | TEMU7096484 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 623 | TRHU8090566 | CMA CGM | BAHIA | PTN | 2025-09-19 | 2025-09-22 | cerrado | embarcado | lleno | 0 |
| 624 | APHU7353460 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 625 | BEAU5945394 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 626 | CAAU5939080 | MAERSK | ABBOTT | GAMMA LOGISTICA | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 627 | CAAU6235505 | MAERSK | ABBOTT | HUXLEY | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 628 | CMAU4673149 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 629 | CMAU5665868 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 630 | CMAU5816012 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 631 | CMAU7182787 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 632 | CMAU7205408 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 633 | CMAU7384371 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 634 | CMAU7492437 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 635 | CMAU7767468 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 636 | CMAU7768660 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 637 | CMAU9153685 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 638 | CRSU9315793 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 639 | DBOU4533360 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 640 | DFSU6819843 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 641 | ECMU7311676 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 642 | FFAU1681386 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 643 | FFAU4328686 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 644 | MRKU3151046 | MAERSK | ABBOTT | HUXLEY | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 645 | MRKU3564190 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-24 | 2025-10-10 | cerrado | embarcado | lleno | 105 |
| 646 | MRSU3080095 | MAERSK | ABBOTT | HUXLEY | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 647 | MRSU8166205 | MAERSK | ABBOTT | HUXLEY | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 648 | SEGU6307415 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 649 | TCKU6278793 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 650 | TCLU1703840 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 651 | TCLU6441378 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-09 | cerrado | embarcado | lleno | 50 |
| 652 | TCLU8960562 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-26 | cerrado | embarcado | lleno | 0 |
| 653 | TEMU7557816 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 654 | TEMU7612050 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 655 | TGHU6301122 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-09 | cerrado | embarcado | lleno | 50 |
| 656 | TLLU4274500 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 657 | TLLU4274979 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 658 | UETU6510003 | CMA CGM | BAHIA | PTN | 2025-09-24 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 659 | CAAU6699208 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 660 | CAAU6976262 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-10-17 | cerrado | embarcado | lleno | 225 |
| 661 | CMAU4399357 | CMA CGM | BAHIA | PTN | 2025-09-25 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 662 | CMAU7345272 | CMA CGM | BAHIA | PTN | 2025-09-25 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 663 | FANU1240337 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 664 | FANU3683334 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-10-23 | cerrado | embarcado | lleno | 375 |
| 665 | FSCU8246751 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 666 | HAMU1243885 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 667 | HAMU1638150 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 668 | HAMU3421970 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 669 | HAMU3936180 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 670 | HAMU4335157 | HAPAG LLOYD | BAHIA | PTN | 2025-09-25 | 2025-10-23 | cerrado | embarcado | lleno | 375 |
| 671 | BMOU6399836 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 672 | CAIU7118419 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 673 | CAIU9242687 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 674 | CAIU9691780 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 675 | CMAU3796555 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 676 | CMAU4929056 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 677 | CMAU6532279 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 678 | CMAU7064233 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 679 | CMAU7890615 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 680 | CMAU9530080 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 681 | CRSU9314884 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 682 | FFAU4302085 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 683 | FSCU7130920 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 684 | TCNU1239422 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 685 | TCNU7967277 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 686 | TEMU6481824 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 687 | TEMU6482081 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 688 | TGBU5075749 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 689 | TGHU6309252 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 690 | TGHU6385210 | CMA CGM | BAHIA | PTN | 2025-09-26 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 691 | BMOU6100800 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 692 | CAIU9582408 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 693 | CMAU3367571 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 694 | CMAU4483088 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 695 | CMAU4517017 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 696 | CMAU5877065 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 697 | CMAU6586254 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 698 | CMAU7269212 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 699 | CMAU9402140 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 700 | CRSU9211166 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 701 | FFAU2059607 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 702 | SEGU4939640 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 703 | SEGU6362665 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 704 | TCLU1850943 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 705 | TCLU1887222 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-29 | cerrado | embarcado | lleno | 0 |
| 706 | TCNU2847793 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 707 | TCNU3616660 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 708 | TCNU4139319 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 709 | TCNU4317262 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 710 | TCNU6821267 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 711 | TEMU6231569 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 712 | TEMU6458676 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-01 | cerrado | embarcado | lleno | 0 |
| 713 | TGHU6361543 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 714 | TIIU6556394 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 715 | TIIU7058858 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 716 | TLLU4930320 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 717 | TLLU7860633 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 718 | TXGU8412152 | CMA CGM | BAHIA | PTN | 2025-09-27 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 719 | CMAU4827100 | CMA CGM | BAHIA | PTN | 2025-09-29 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 720 | TCNU6999583 | CMA CGM | BAHIA | PTN | 2025-09-29 | 2025-09-30 | cerrado | embarcado | lleno | 0 |
| 721 | MRSU4432950 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-30 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 722 | MRSU7944246 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-30 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 723 | TCNU2490406 | MAERSK | BAHIA | TERMINAL 4 | 2025-09-30 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 724 | BEAU5142258 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 725 | BMOU5422994 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 726 | BMOU5611283 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 727 | CMAU3522960 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 728 | CMAU4163530 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-23 | cerrado | embarcado | lleno | 200 |
| 729 | CMAU4256042 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 730 | CMAU4513984 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 731 | CMAU6384865 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 732 | CMAU7573190 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 733 | CMAU9241549 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 734 | CMAU9373078 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 735 | ECMU4950610 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 736 | GCXU5574811 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 737 | GESU6608190 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-03 | cerrado | embarcado | lleno | 0 |
| 738 | HASU4941897 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-21 | cerrado | embarcado | lleno | 210 |
| 739 | HASU5060375 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 740 | MRSU3211739 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 741 | MRSU3259310 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 742 | MRSU4731843 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 743 | MRSU5238370 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 744 | MRSU5639623 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-28 | cerrado | embarcado | lleno | 455 |
| 745 | MRSU5916688 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 746 | MRSU7423295 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 747 | MRSU7803016 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 748 | MRSU8719065 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 749 | MRSU8731097 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 750 | MRSU8771736 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 751 | MSKU0083232 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 752 | MSKU1990198 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-24 | cerrado | embarcado | lleno | 315 |
| 753 | SEKU4598682 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-28 | cerrado | embarcado | lleno | 455 |
| 754 | SEKU6040072 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 755 | TCKU6246590 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 756 | TCKU6419187 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 757 | TCKU7084468 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-21 | cerrado | embarcado | lleno | 210 |
| 758 | TCLU9287292 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 759 | TCNU4520238 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 760 | TEMU7751890 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 761 | TGBU7115460 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 762 | TGHU6597436 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 763 | TIIU4291824 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 764 | TLLU4549572 | CMA CGM | BAHIA | PTN | 2025-10-02 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 765 | TLLU7617120 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-28 | cerrado | embarcado | lleno | 455 |
| 766 | UETU6298738 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-02 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 767 | BEAU4011253 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 768 | BEAU5648462 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 769 | BEAU6130523 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 770 | CMAU3666398 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 771 | CMAU3814520 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 772 | CMAU5536388 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 773 | CMAU5727002 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 774 | CMAU6226920 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 775 | CMAU8517490 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 776 | CMAU8822873 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-06 | cerrado | embarcado | lleno | 0 |
| 777 | ECMU4726771 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 778 | ECMU7542295 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 779 | ECMU7589749 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 780 | ECMU7610888 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 781 | FCIU9090957 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 782 | GCXU5378932 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 783 | SEGU6097432 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-29 | cerrado | embarcado | lleno | 325 |
| 784 | TCLU8657670 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 785 | TCLU9301045 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 786 | TCNU3322876 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 787 | TEMU8656644 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 788 | TXGU7955556 | CMA CGM | BAHIA | PTN | 2025-10-03 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 789 | APHU7207634 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 790 | CAAU7013040 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-04 | 2025-10-28 | cerrado | embarcado | lleno | 385 |
| 791 | CAAU7937487 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-27 | cerrado | embarcado | lleno | 350 |
| 792 | CAAU9052827 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-27 | cerrado | embarcado | lleno | 350 |
| 793 | CAIU9064435 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 794 | CMAU4539968 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 795 | CMAU6918390 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-07 | cerrado | embarcado | lleno | 0 |
| 796 | CMAU7394106 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 797 | CMAU8579681 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 798 | FCIU9042291 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-11-10 | cerrado | embarcado | lleno | 600 |
| 799 | MAGU5737870 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 800 | MRKU2382457 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-04 | 2025-10-28 | cerrado | embarcado | lleno | 385 |
| 801 | MRKU4834807 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-24 | cerrado | embarcado | lleno | 245 |
| 802 | MRKU5409417 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 803 | MRKU5830323 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-04 | 2025-10-24 | cerrado | embarcado | lleno | 245 |
| 804 | MRSU6379768 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-27 | cerrado | embarcado | lleno | 350 |
| 805 | MRSU6978128 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 806 | SEGU4335402 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-17 | cerrado | devuelto_vacio | vacio | 0 |
| 807 | SUDU6914466 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 808 | TCLU8956177 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 809 | TCNU1297476 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 810 | TGCU0059693 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-23 | cerrado | embarcado | lleno | 150 |
| 811 | TGCU5425100 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 812 | TLLU5969733 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 813 | TRHU4861290 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 814 | TRHU6931123 | MAERSK | BAHIA | PTN | 2025-10-04 | 2025-10-24 | cerrado | embarcado | lleno | 245 |
| 815 | TRLU7414680 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 816 | TXGU8359401 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 817 | UETU5518484 | CMA CGM | BAHIA | PTN | 2025-10-04 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 818 | BEAU4168788 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 819 | CAAU5464810 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 820 | FANU1693919 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 821 | FANU3737050 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 822 | FSCU8107252 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 823 | GCXU5535733 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-11-25 | cerrado | embarcado | lleno | 1,295 |
| 824 | HLBU1701993 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 825 | HLBU2539779 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 826 | HLBU2833952 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 827 | MRKU3423756 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-21 | cerrado | embarcado | lleno | 70 |
| 828 | MRSU7525511 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-29 | cerrado | embarcado | lleno | 350 |
| 829 | MRSU7671917 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-21 | cerrado | embarcado | lleno | 70 |
| 830 | MRSU8300546 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-12-01 | cerrado | embarcado | lleno | 1,505 |
| 831 | MSKU1694200 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-21 | cerrado | embarcado | lleno | 70 |
| 832 | SLSU8070582 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 833 | TCKU6778572 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-28 | cerrado | embarcado | lleno | 315 |
| 834 | TCNU1498790 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 835 | TCNU1891554 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-10-06 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 836 | TCNU3463489 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-30 | cerrado | embarcado | lleno | 385 |
| 837 | TCNU4374278 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-28 | cerrado | embarcado | lleno | 315 |
| 838 | TRHU6320443 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-06 | 2025-10-21 | cerrado | embarcado | lleno | 70 |
| 839 | CMAU3336966 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 840 | CMAU4239220 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 841 | CMAU9380288 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 842 | ECMU4895792 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 843 | ECMU4922347 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 844 | ECMU7192936 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 845 | ECMU7235534 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 846 | ECMU7706249 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 847 | FFAU4512543 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 848 | SEKU5693489 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 849 | SELU4757082 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 850 | TCNU5859890 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-08 | cerrado | embarcado | lleno | 0 |
| 851 | TGHU6352808 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 852 | TLLU7590688 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 853 | TLLU8886015 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 854 | TXGU7144564 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 855 | UETU7135015 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 856 | UETU7208430 | CMA CGM | BAHIA | PTN | 2025-10-07 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 857 | CMAU3920959 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 858 | CMAU6104326 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 859 | CMAU6113971 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 860 | CMAU6186962 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 861 | CMAU6535869 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 862 | CMAU7874743 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 863 | CMAU8660324 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 864 | CMAU8744678 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 865 | CMAU8872576 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 866 | CMAU9681208 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 867 | CXDU1117800 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 868 | ECMU9696643 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 869 | FSCU8261777 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 870 | TCKU6242851 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 871 | TCKU6510846 | MAERSK | ABBOTT | HUXLEY | 2025-10-08 | 2025-10-30 | cerrado | embarcado | lleno | 315 |
| 872 | TCLU9777181 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 873 | TCNU6997301 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-09 | cerrado | embarcado | lleno | 0 |
| 874 | TEMU7742460 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-29 | cerrado | embarcado | lleno | 200 |
| 875 | TGBU5191184 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 876 | TGBU5424347 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 877 | TLLU4834939 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 878 | TXGU8357538 | CMA CGM | BAHIA | PTN | 2025-10-08 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 879 | BEAU6139897 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 880 | BMOU5613985 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 881 | BMOU6193824 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 882 | CAIU4689137 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 883 | CAIU9302030 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-16 | cerrado | embarcado | lleno | 0 |
| 884 | CMAU6265892 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 885 | CMAU6935818 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 886 | ECMU7631833 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 887 | FFAU4223685 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 888 | SELU4753493 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 889 | SELU4758350 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 890 | TCLU5678806 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 891 | TCNU6926843 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 892 | TGBU9386883 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 893 | TLLU4887796 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 894 | TLLU5191586 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 895 | TLLU8873701 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 896 | TRHU7150104 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 897 | TXGU8150535 | CMA CGM | BAHIA | PTN | 2025-10-09 | 2025-10-13 | cerrado | embarcado | lleno | 0 |
| 898 | FFAU4795741 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-28 | cerrado | embarcado | lleno | 175 |
| 899 | FFAU7154361 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-30 | cerrado | embarcado | lleno | 245 |
| 900 | HASU4108690 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-30 | cerrado | embarcado | lleno | 245 |
| 901 | HASU4798132 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 902 | MRKU2089325 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-11-04 | cerrado | embarcado | lleno | 420 |
| 903 | MRKU5869310 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-28 | cerrado | embarcado | lleno | 175 |
| 904 | MRSU5529755 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-29 | cerrado | embarcado | lleno | 210 |
| 905 | MRSU7372454 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-24 | cerrado | embarcado | lleno | 35 |
| 906 | MRSU8503570 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-28 | cerrado | embarcado | lleno | 175 |
| 907 | TCKU6873760 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-28 | cerrado | embarcado | lleno | 175 |
| 908 | TCKU7191194 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-28 | cerrado | embarcado | lleno | 175 |
| 909 | TCNU3816143 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-29 | cerrado | embarcado | lleno | 210 |
| 910 | TRHU4751740 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-29 | cerrado | embarcado | lleno | 210 |
| 911 | TRHU8284514 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-10 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 912 | BEAU6264163 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-30 | cerrado | embarcado | lleno | 100 |
| 913 | CMAU3779650 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 914 | CMAU4393641 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 915 | CMAU4490220 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-29 | cerrado | embarcado | lleno | 75 |
| 916 | CMAU4662709 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-29 | cerrado | embarcado | lleno | 75 |
| 917 | CMAU6372099 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 918 | CMAU7015590 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 919 | CMAU9535327 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 920 | DFSU6619254 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-30 | cerrado | embarcado | lleno | 100 |
| 921 | ECMU7235724 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 922 | ECMU7303048 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-12-15 | cerrado | embarcado | lleno | 1,250 |
| 923 | ECMU7408603 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 924 | ECMU7499624 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-27 | cerrado | embarcado | lleno | 25 |
| 925 | FFAU5969581 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 926 | FFAU5991688 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 927 | GESU6864057 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 928 | GESU6877898 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 929 | SEGU4887166 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 930 | SELU4510600 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 931 | TCKU6257595 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 932 | TCLU9582575 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 933 | TCNU5800383 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-29 | cerrado | embarcado | lleno | 75 |
| 934 | TCNU6232992 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 935 | TCNU6605545 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-27 | cerrado | embarcado | lleno | 25 |
| 936 | TCNU7515338 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-29 | cerrado | embarcado | lleno | 75 |
| 937 | TEMU7194393 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-14 | cerrado | embarcado | lleno | 0 |
| 938 | TGBU6803793 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 939 | TGCU5439042 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 940 | TLLU8778108 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 941 | TRHU4934313 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 942 | TRHU8002040 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 943 | TXGU8157036 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-15 | cerrado | embarcado | lleno | 0 |
| 944 | UETU7297269 | CMA CGM | BAHIA | PTN | 2025-10-13 | 2025-10-29 | cerrado | embarcado | lleno | 75 |
| 945 | CMAU4569643 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-28 | cerrado | devuelto_vacio | vacio | 25 |
| 946 | CMAU6536459 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 947 | ECMU7020710 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 948 | FFAU3972689 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 949 | HPCU4275228 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 950 | SEKU4496680 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 951 | TCKU6329083 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 952 | TCNU3310094 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 953 | TLLU4568211 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-17 | cerrado | embarcado | lleno | 0 |
| 954 | TRHU4728185 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 955 | TRHU8180994 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 956 | UETU6146289 | CMA CGM | BAHIA | PTN | 2025-10-14 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 957 | APHU7086872 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-30 | cerrado | embarcado | lleno | 50 |
| 958 | CAAU7762840 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-11-18 | cerrado | embarcado | lleno | 735 |
| 959 | CAIU8956524 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 960 | CMAU3524860 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-11-10 | cerrado | embarcado | lleno | 325 |
| 961 | CMAU4957119 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 962 | CMAU6804778 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 963 | CMAU9380020 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 964 | CMAU9424318 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 965 | ECMU7251915 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-30 | cerrado | embarcado | lleno | 50 |
| 966 | ECMU7537257 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 967 | FFAU4424036 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 968 | GESU6157270 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 969 | GESU6183032 | CMA CGM | BAHIA | PTN | 2025-10-15 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 970 | HASU4609244 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 971 | HASU5086364 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-11-04 | cerrado | embarcado | lleno | 245 |
| 972 | MIEU3041199 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 973 | MRKU2216923 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-11-18 | cerrado | embarcado | lleno | 735 |
| 974 | MRKU2220219 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 975 | MRKU3460390 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-30 | cerrado | embarcado | lleno | 70 |
| 976 | MRKU3615018 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 977 | MRKU3816630 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 978 | MRKU3938812 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-11-18 | cerrado | embarcado | lleno | 735 |
| 979 | MRKU3979046 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 980 | MRKU5939130 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-11-25 | cerrado | embarcado | lleno | 980 |
| 981 | MRSU4096305 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-30 | cerrado | embarcado | lleno | 70 |
| 982 | MRSU4119571 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 983 | MRSU4928447 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-30 | cerrado | embarcado | lleno | 70 |
| 984 | MRSU4966534 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 985 | MRSU5149349 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-11-25 | cerrado | embarcado | lleno | 980 |
| 986 | MRSU5436246 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 987 | MRSU6997982 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 988 | MRSU7164620 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 989 | MRSU7205734 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-30 | cerrado | embarcado | lleno | 70 |
| 990 | MRSU7295764 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-11-25 | cerrado | embarcado | lleno | 980 |
| 991 | MRSU7459750 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 992 | MRSU8720106 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 993 | MRSU8769282 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 994 | MSKU9813028 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-11-26 | cerrado | embarcado | lleno | 1,015 |
| 995 | SEKU6931004 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 996 | SUDU8854598 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 997 | TCKU7011585 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 998 | TCNU5949720 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 999 | TCNU7896677 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-24 | cerrado | embarcado | lleno | 0 |
| 1000 | TRHU4989086 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 1001 | UETU6680437 | MAERSK | BAHIA | PTN | 2025-10-15 | 2025-10-29 | cerrado | embarcado | lleno | 35 |
| 1002 | BMOU6985164 | CMA CGM | BAHIA | PTN | 2025-10-16 | 2025-12-15 | cerrado | embarcado | lleno | 1,175 |
| 1003 | CMAU4636530 | CMA CGM | BAHIA | PTN | 2025-10-16 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 1004 | CMAU7085576 | CMA CGM | BAHIA | PTN | 2025-10-16 | 2025-10-30 | cerrado | embarcado | lleno | 25 |
| 1005 | CMAU7514990 | CMA CGM | BAHIA | PTN | 2025-10-16 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1006 | CMAU9261102 | CMA CGM | BAHIA | PTN | 2025-10-16 | 2025-10-30 | cerrado | embarcado | lleno | 25 |
| 1007 | CMAU9349301 | CMA CGM | BAHIA | PTN | 2025-10-16 | 2025-10-30 | cerrado | embarcado | lleno | 25 |
| 1008 | MRSU5391141 | MAERSK | ABBOTT | HUXLEY | 2025-10-16 | 2025-10-30 | cerrado | embarcado | lleno | 35 |
| 1009 | MRSU5559765 | MAERSK | ABBOTT | HUXLEY | 2025-10-16 | 2025-10-30 | cerrado | embarcado | lleno | 35 |
| 1010 | CAAU5404215 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1011 | CAAU7931679 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1012 | GCXU6524590 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 1013 | HASU4979629 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 1014 | MRKU2132226 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1015 | MRKU5011001 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1016 | MRKU5268140 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1017 | MRSU3455925 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1018 | MRSU3479697 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1019 | MRSU5490524 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1020 | MRSU6272620 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 1021 | MRSU6721952 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1022 | PONU7924660 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 1023 | SUDU8502391 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 1024 | TCKU6946146 | MAERSK | BAHIA | PTN | 2025-10-17 | 2025-10-21 | cerrado | embarcado | lleno | 0 |
| 1025 | CAAU6348707 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-27 | cerrado | embarcado | lleno | 0 |
| 1026 | CMAU4855098 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1027 | CMAU5192873 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1028 | CMAU6833610 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1029 | CMAU7915626 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-12-15 | cerrado | embarcado | lleno | 1,050 |
| 1030 | CMAU8473724 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1031 | CMAU8558760 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-11-11 | cerrado | embarcado | lleno | 200 |
| 1032 | ECMU7071359 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-11-11 | cerrado | embarcado | lleno | 200 |
| 1033 | MAGU5726496 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-23 | cerrado | embarcado | lleno | 0 |
| 1034 | MRKU2634559 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1035 | MRKU3451906 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1036 | MRKU4008868 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1037 | MRKU4785810 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1038 | MRKU6351881 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-11-04 | cerrado | embarcado | lleno | 35 |
| 1039 | MRSU8359035 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1040 | MRSU8758117 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-11-04 | cerrado | embarcado | lleno | 35 |
| 1041 | MSKU1102893 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1042 | SEKU4464106 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1043 | SEKU6274907 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-11-11 | cerrado | embarcado | lleno | 200 |
| 1044 | TCNU4810807 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-21 | 2025-10-28 | cerrado | embarcado | lleno | 0 |
| 1045 | TCNU5422935 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-11-11 | cerrado | embarcado | lleno | 200 |
| 1046 | TGBU5818994 | CMA CGM | BAHIA | PTN | 2025-10-21 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1047 | BEAU4124223 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1048 | BSIU9274611 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1049 | CAAU6256302 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1050 | CMAU3452478 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1051 | CMAU4465778 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-07 | cerrado | embarcado | lleno | 50 |
| 1052 | CMAU4712190 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1053 | CMAU5589270 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-07 | cerrado | embarcado | lleno | 50 |
| 1054 | CMAU6377207 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-07 | cerrado | embarcado | lleno | 50 |
| 1055 | CMAU7028318 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1056 | CMAU7242720 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1057 | CMAU7245648 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1058 | CMAU7818190 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-07 | cerrado | embarcado | lleno | 50 |
| 1059 | CRSU9187096 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1060 | ECMU7625553 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-12-15 | cerrado | embarcado | lleno | 1,000 |
| 1061 | FBLU0017670 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-07 | cerrado | embarcado | lleno | 50 |
| 1062 | FSCU8069609 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1063 | HPCU4329622 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1064 | SEGU4112883 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1065 | SEKU6089853 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1066 | TCLU1868270 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1067 | TCLU6582102 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1068 | TCLU8956520 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1069 | TCNU2694713 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1070 | TCNU3727149 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1071 | TCNU6185252 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1072 | TIIU6151415 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1073 | TLLU5103991 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-10 | cerrado | embarcado | lleno | 125 |
| 1074 | TLLU7540331 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-11-07 | cerrado | embarcado | lleno | 50 |
| 1075 | TXGU8245219 | CMA CGM | BAHIA | PTN | 2025-10-23 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1076 | BEAU4065429 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1077 | CAAU5945945 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-24 | 2025-11-04 | cerrado | embarcado | lleno | 0 |
| 1078 | CMAU4478651 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-12-15 | cerrado | embarcado | lleno | 975 |
| 1079 | CMAU6335304 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-11-10 | cerrado | embarcado | lleno | 100 |
| 1080 | CMAU9753777 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-11-10 | cerrado | embarcado | lleno | 100 |
| 1081 | DRYU9304440 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1082 | FFAU5105590 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1083 | GCXU5774110 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-24 | 2025-11-04 | cerrado | embarcado | lleno | 0 |
| 1084 | GESU6625047 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-12-15 | cerrado | embarcado | lleno | 975 |
| 1085 | MRSU8732175 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-24 | 2025-11-04 | cerrado | embarcado | lleno | 0 |
| 1086 | SEKU4714247 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-24 | 2025-11-04 | cerrado | embarcado | lleno | 0 |
| 1087 | SUDU6520462 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-24 | 2025-11-04 | cerrado | embarcado | lleno | 0 |
| 1088 | TCKU6284625 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-11-10 | cerrado | embarcado | lleno | 100 |
| 1089 | TCLU1887069 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-11-10 | cerrado | embarcado | lleno | 100 |
| 1090 | TCLU6500640 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1091 | TCLU9635844 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1092 | TCNU3005845 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-12-15 | cerrado | embarcado | lleno | 975 |
| 1093 | TCNU3009481 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1094 | TCNU5450650 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-11-10 | cerrado | embarcado | lleno | 100 |
| 1095 | TCNU5576123 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-12-15 | cerrado | embarcado | lleno | 975 |
| 1096 | TGHU6353450 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1097 | TLLU7831804 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1098 | TLLU8784097 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-11-10 | cerrado | embarcado | lleno | 100 |
| 1099 | TRHU7892926 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-29 | cerrado | embarcado | lleno | 0 |
| 1100 | TRHU8681574 | CMA CGM | BAHIA | PTN | 2025-10-24 | 2025-10-30 | cerrado | embarcado | lleno | 0 |
| 1101 | BEAU5196172 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-19 | cerrado | embarcado | lleno | 315 |
| 1102 | CAAU7062934 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-18 | cerrado | embarcado | lleno | 280 |
| 1103 | HASU5170623 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-18 | cerrado | embarcado | lleno | 280 |
| 1104 | MRKU2655905 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-25 | cerrado | embarcado | lleno | 525 |
| 1105 | MRSU4895317 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-12 | cerrado | embarcado | lleno | 70 |
| 1106 | MRSU5625677 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-18 | cerrado | embarcado | lleno | 280 |
| 1107 | MRSU8496188 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-12 | cerrado | embarcado | lleno | 70 |
| 1108 | MSKU0130967 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-18 | cerrado | embarcado | lleno | 280 |
| 1109 | MSKU1939621 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-18 | cerrado | embarcado | lleno | 280 |
| 1110 | TCLU9308055 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-18 | cerrado | embarcado | lleno | 280 |
| 1111 | TCNU1342092 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-12 | cerrado | embarcado | lleno | 70 |
| 1112 | TGHU6045015 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-19 | cerrado | embarcado | lleno | 315 |
| 1113 | TLLU5867808 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-28 | 2025-11-12 | cerrado | embarcado | lleno | 70 |
| 1114 | BSIU9084669 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-25 | cerrado | embarcado | lleno | 455 |
| 1115 | GAOU7207182 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1116 | MRSU4042818 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1117 | MRSU4135607 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1118 | MRSU4665989 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1119 | MRSU4883173 | MAERSK | ABBOTT | HUXLEY | 2025-10-30 | 2025-11-13 | cerrado | embarcado | lleno | 35 |
| 1120 | MRSU5124058 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1121 | MRSU5530925 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-25 | cerrado | embarcado | lleno | 455 |
| 1122 | MRSU6809703 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1123 | MRSU8398598 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1124 | MRSU8453165 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-12 | cerrado | embarcado | lleno | 0 |
| 1125 | SELU4013455 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-25 | cerrado | embarcado | lleno | 455 |
| 1126 | TCKU6778464 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-25 | cerrado | embarcado | lleno | 455 |
| 1127 | TCNU1950739 | MAERSK | BAHIA | TERMINAL 4 | 2025-10-30 | 2025-11-18 | cerrado | embarcado | lleno | 210 |
| 1128 | CAAU7870758 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-12 | cerrado | embarcado | lleno | 0 |
| 1129 | CAAU8576310 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1130 | CAAU9119237 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-12 | cerrado | embarcado | lleno | 0 |
| 1131 | HASU4492374 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1132 | HASU4556735 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-26 | cerrado | embarcado | lleno | 420 |
| 1133 | MRKU3643895 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-04 | cerrado | embarcado | lleno | 700 |
| 1134 | MRKU3698500 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1135 | MRKU4835681 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1136 | MRKU5423879 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1137 | MRSU4462071 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1138 | MSKU0777634 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-01 | cerrado | embarcado | lleno | 595 |
| 1139 | SUDU6534698 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1140 | SUDU6565512 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1141 | TCKU7995870 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-01 | cerrado | embarcado | lleno | 595 |
| 1142 | TCNU2052930 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-12 | cerrado | embarcado | lleno | 980 |
| 1143 | TCNU7354423 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1144 | TGBU5364171 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-01 | cerrado | embarcado | lleno | 595 |
| 1145 | TLLU7617346 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-11-25 | cerrado | embarcado | lleno | 385 |
| 1146 | TRHU8045844 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-02 | cerrado | embarcado | lleno | 630 |
| 1147 | UETU6952535 | MAERSK | BAHIA | PTN | 2025-11-01 | 2025-12-04 | cerrado | embarcado | lleno | 700 |
| 1148 | MRKU4884773 | MAERSK | ABBOTT | HUXLEY | 2025-11-03 | 2025-11-06 | cerrado | embarcado | lleno | 0 |
| 1149 | MRKU6383493 | MAERSK | ABBOTT | HUXLEY | 2025-11-03 | 2025-11-06 | cerrado | embarcado | lleno | 0 |
| 1150 | MRSU4781309 | MAERSK | ABBOTT | HUXLEY | 2025-11-03 | 2025-11-06 | cerrado | embarcado | lleno | 0 |
| 1151 | SUDU8616368 | MAERSK | ABBOTT | HUXLEY | 2025-11-03 | 2025-11-06 | cerrado | embarcado | lleno | 0 |
| 1152 | TCKU7187553 | MAERSK | ABBOTT | HUXLEY | 2025-11-03 | 2025-11-06 | cerrado | embarcado | lleno | 0 |
| 1153 | UETU7566100 | MAERSK | ABBOTT | HUXLEY | 2025-11-03 | 2025-11-06 | cerrado | embarcado | lleno | 0 |
| 1154 | GAOU7553821 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-18 | cerrado | embarcado | lleno | 35 |
| 1155 | GCXU5803585 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-18 | cerrado | embarcado | lleno | 35 |
| 1156 | HASU5069069 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-18 | cerrado | embarcado | lleno | 35 |
| 1157 | MRKU3062144 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-18 | cerrado | embarcado | lleno | 35 |
| 1158 | MRSU6679744 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-12 | cerrado | embarcado | lleno | 0 |
| 1159 | MRSU6855210 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-12 | cerrado | embarcado | lleno | 0 |
| 1160 | MRSU8252880 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-18 | cerrado | embarcado | lleno | 35 |
| 1161 | MSKU0345292 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-12 | cerrado | embarcado | lleno | 0 |
| 1162 | MSKU1897721 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-04 | 2025-11-18 | cerrado | embarcado | lleno | 35 |
| 1163 | CAAU6975564 | HAPAG LLOYD | ABBOTT | TERMINAL EXOLGAN | 2025-11-06 | 2025-11-13 | cerrado | embarcado | lleno | 0 |
| 1164 | FANU3812690 | HAPAG LLOYD | ABBOTT | TERMINAL EXOLGAN | 2025-11-06 | 2025-11-13 | cerrado | embarcado | lleno | 0 |
| 1165 | HLBU3103060 | HAPAG LLOYD | ABBOTT | TERMINAL EXOLGAN | 2025-11-06 | 2025-11-13 | cerrado | embarcado | lleno | 0 |
| 1166 | MRSU6484613 | MAERSK | ABBOTT | HUXLEY | 2025-11-06 | 2025-11-20 | cerrado | embarcado | lleno | 35 |
| 1167 | MTSU9617101 | MAERSK | ABBOTT | HUXLEY | 2025-11-06 | 2025-11-20 | cerrado | embarcado | lleno | 35 |
| 1168 | TGBU5836072 | HAPAG LLOYD | ABBOTT | TERMINAL EXOLGAN | 2025-11-06 | 2025-11-13 | cerrado | embarcado | lleno | 0 |
| 1169 | CAAU6461797 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1170 | FANU1134042 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-13 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1171 | GCXU6467680 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1172 | HAMU3531068 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-13 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1173 | HASU4442096 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1174 | HLBU1298656 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-13 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1175 | MIEU3008884 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1176 | MRKU3376968 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-12-01 | cerrado | embarcado | lleno | 175 |
| 1177 | MRKU3518466 | MAERSK | ABBOTT | HUXLEY | 2025-11-13 | 2025-11-28 | cerrado | embarcado | lleno | 70 |
| 1178 | MRKU6362295 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1179 | MRSU5695503 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1180 | MRSU7566887 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1181 | MRSU8316753 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-12-01 | cerrado | embarcado | lleno | 175 |
| 1182 | SUDU6607475 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-13 | 2025-12-01 | cerrado | embarcado | lleno | 175 |
| 1183 | TGBU6685068 | MAERSK | ABBOTT | HUXLEY | 2025-11-13 | 2025-11-28 | cerrado | embarcado | lleno | 70 |
| 1184 | WFHU5199152 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-13 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1185 | CAAU6555751 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-01 | cerrado | embarcado | lleno | 140 |
| 1186 | DFSU7315960 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1187 | FANU1675073 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1188 | FANU3585180 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1189 | FDCU0140996 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1190 | FFAU2096220 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1191 | GCXU5808967 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1192 | HAMU2729613 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1193 | HASU4036203 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1194 | HASU4082050 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1195 | HASU4900753 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-09 | cerrado | embarcado | lleno | 420 |
| 1196 | HLBU1691880 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1197 | HLBU3384516 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1198 | HLXU8299287 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1199 | MRKU4555206 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1200 | MRKU5942426 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-01 | cerrado | embarcado | lleno | 140 |
| 1201 | MRSU3980179 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-01 | cerrado | embarcado | lleno | 140 |
| 1202 | MRSU4442310 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1203 | MRSU4741250 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-01 | cerrado | embarcado | lleno | 140 |
| 1204 | MRSU6255556 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-01 | cerrado | embarcado | lleno | 140 |
| 1205 | MRSU6485564 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1206 | MRSU7202000 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-03 | cerrado | embarcado | lleno | 210 |
| 1207 | MSKU1459659 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-01 | cerrado | embarcado | lleno | 140 |
| 1208 | SUDU6968586 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-04 | cerrado | embarcado | lleno | 245 |
| 1209 | SUDU8662424 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1210 | SUDU8804956 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-09 | cerrado | embarcado | lleno | 420 |
| 1211 | TCLU9312409 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-04 | cerrado | embarcado | lleno | 245 |
| 1212 | TCNU1840623 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-09 | cerrado | embarcado | lleno | 420 |
| 1213 | TCNU2615000 | MAERSK | BAHIA | PTN | 2025-11-14 | 2025-12-04 | cerrado | embarcado | lleno | 245 |
| 1214 | TCNU3545083 | MAERSK | ABBOTT | HUXLEY | 2025-11-14 | 2025-11-28 | cerrado | embarcado | lleno | 35 |
| 1215 | UETU6750920 | HAPAG LLOYD | BAHIA | PTN | 2025-11-14 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1216 | BEAU5745708 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1217 | BEAU6371496 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1218 | CAAU8564475 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-19 | cerrado | embarcado | lleno | 0 |
| 1219 | CAIU4990900 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1220 | GCXU6200570 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-12-09 | cerrado | embarcado | lleno | 280 |
| 1221 | GCXU6317016 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1222 | MRKU2097547 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1223 | MRKU2612420 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1224 | MRKU2660054 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1225 | MRKU3296841 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1226 | MRKU3892732 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1227 | MRKU4041531 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1228 | MRKU5113889 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1229 | MRKU6244158 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1230 | MRSU3192583 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1231 | MRSU3704761 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1232 | MRSU4681871 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1233 | MRSU5391199 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1234 | MRSU6543341 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1235 | MRSU7280595 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1236 | MSKU0956497 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-12-01 | cerrado | embarcado | lleno | 0 |
| 1237 | MSKU1108037 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1238 | MSKU1150850 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1239 | MSKU1460794 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1240 | MSKU9264020 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-12-03 | cerrado | embarcado | lleno | 70 |
| 1241 | PONU7426098 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1242 | TCKU7105262 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1243 | TCKU7178248 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1244 | TCKU7633568 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1245 | TCLU9310448 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1246 | TCNU1843540 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1247 | TCNU2778820 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1248 | TCNU8339125 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1249 | TGHU9895861 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1250 | TLLU4781145 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1251 | TRHU4030229 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-12-02 | cerrado | embarcado | lleno | 35 |
| 1252 | TRHU4835157 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1253 | TRHU7145854 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-18 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1254 | UETU5925387 | MAERSK | BAHIA | PTN | 2025-11-18 | 2025-11-20 | cerrado | embarcado | lleno | 0 |
| 1255 | CAAU6659885 | MAERSK | BAHIA | PTN | 2025-11-19 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1256 | GAOU7204590 | MAERSK | BAHIA | PTN | 2025-11-19 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1257 | HASU4258880 | MAERSK | BAHIA | PTN | 2025-11-19 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1258 | HASU4508151 | MAERSK | BAHIA | PTN | 2025-11-19 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1259 | MRKU3472339 | MAERSK | BAHIA | PTN | 2025-11-19 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1260 | TEMU6927222 | MAERSK | BAHIA | PTN | 2025-11-19 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1261 | FANU1083562 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1262 | FANU1407430 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-20 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1263 | FANU1701228 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1264 | FANU3411228 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1265 | FDCU0130540 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1266 | FFAU1669992 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1267 | GCXU5164036 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-20 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1268 | GCXU5293460 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1269 | GCXU5989844 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-20 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1270 | HASU4504747 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1271 | HLBU1769289 | HAPAG LLOYD | ABBOTT | EXOLGAN | 2025-11-20 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1272 | HLBU2088588 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1273 | HLBU2700965 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1274 | MRKU2642174 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1275 | MRSU6681401 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-12-01 | cerrado | embarcado | lleno | 0 |
| 1276 | MRSU7844118 | MAERSK | ABBOTT | HUXLEY | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1277 | MSKU0462637 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-11-27 | cerrado | devuelto_vacio | vacio | 0 |
| 1278 | TCKU7739098 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1279 | TCNU4128823 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1280 | TCNU6392460 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1281 | TGBU6847472 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1282 | TRHU4594888 | MAERSK | BAHIA | PTN | 2025-11-20 | 2025-11-26 | cerrado | embarcado | lleno | 0 |
| 1283 | UETU6526252 | HAPAG LLOYD | BAHIA | PTN | 2025-11-20 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1284 | MRKU2664126 | MAERSK | BAHIA | PTN | 2025-11-21 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1285 | MRKU5298519 | MAERSK | BAHIA | PTN | 2025-11-21 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1286 | MRSU3753679 | MAERSK | BAHIA | PTN | 2025-11-21 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1287 | MRSU6939604 | MAERSK | BAHIA | PTN | 2025-11-21 | 2025-11-25 | cerrado | embarcado | lleno | 0 |
| 1288 | CAAU4697675 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1289 | CAAU4723007 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1290 | CAAU9976899 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1291 | CIPU5118185 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1292 | GAOU7203715 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1293 | MIEU2006634 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-10 | cerrado | embarcado | lleno | 70 |
| 1294 | MRKU2809111 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1295 | MRKU3273743 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-12 | cerrado | embarcado | lleno | 140 |
| 1296 | MRKU4471975 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1297 | MRKU6412246 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-12 | cerrado | embarcado | lleno | 140 |
| 1298 | MRSU3571000 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-12 | cerrado | embarcado | lleno | 140 |
| 1299 | MRSU5381400 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1300 | MRSU6319537 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1301 | MRSU6464860 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-30 | cerrado | embarcado | lleno | 770 |
| 1302 | MRSU6575117 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1303 | MRSU6754787 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-10 | cerrado | embarcado | lleno | 70 |
| 1304 | MRSU6770237 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-12 | cerrado | embarcado | lleno | 140 |
| 1305 | MRSU7418149 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-12 | cerrado | embarcado | lleno | 140 |
| 1306 | MRSU8326366 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1307 | MRSU8689947 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1308 | MSKU0218940 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1309 | MSKU1647928 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1310 | MSKU1864707 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1311 | SEKU4593063 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-10 | cerrado | embarcado | lleno | 70 |
| 1312 | SUDU6888808 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1313 | SUDU8619310 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-10 | cerrado | embarcado | lleno | 70 |
| 1314 | TCKU6527480 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1315 | TGBU6849449 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1316 | TLLU4888447 | MAERSK | BAHIA | TERMINAL 4 | 2025-11-25 | 2025-12-04 | cerrado | embarcado | lleno | 0 |
| 1317 | BEAU6355181 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1318 | CAAU7070565 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1319 | CAIU8281821 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1320 | GAOU7133726 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-20 | cerrado | embarcado | lleno | 385 |
| 1321 | HASU4748240 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1322 | HASU4783493 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-01 | cerrado | embarcado | lleno | 0 |
| 1323 | MIEU0046330 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1324 | MRKU2014938 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1325 | MRKU2248900 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1326 | MRKU2390576 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-01 | cerrado | embarcado | lleno | 0 |
| 1327 | MRKU2730803 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1328 | MRKU2787624 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1329 | MRKU2990251 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1330 | MRKU3698711 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1331 | MRKU3929364 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-12 | cerrado | embarcado | lleno | 105 |
| 1332 | MRKU4185930 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1333 | MRKU4263117 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-01 | cerrado | embarcado | lleno | 0 |
| 1334 | MRKU4327464 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1335 | MRKU4952142 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1336 | MRSU3328670 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1337 | MRSU3406643 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1338 | MRSU3604232 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1339 | MRSU3751260 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1340 | MRSU4533534 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1341 | MRSU5118712 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1342 | MRSU5463600 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1343 | MRSU5558250 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1344 | MRSU5817290 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-12 | cerrado | embarcado | lleno | 105 |
| 1345 | MRSU6337593 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1346 | MRSU6430520 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1347 | MRSU6623637 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-12 | cerrado | embarcado | lleno | 105 |
| 1348 | MRSU6741692 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-01 | cerrado | embarcado | lleno | 0 |
| 1349 | MRSU6936288 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1350 | MRSU7130532 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1351 | MSKU0240748 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1352 | MSKU1648781 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1353 | MSKU9525166 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1354 | MTSU9617858 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1355 | SEKU4595317 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1356 | SUDU6710082 | MAERSK | BAHIA | PTN | 2025-11-26 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1357 | CAAU6791401 | MAERSK | BAHIA | PTN | 2025-11-27 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1358 | MRSU6854507 | MAERSK | BAHIA | PTN | 2025-11-27 | 2025-12-20 | cerrado | embarcado | lleno | 350 |
| 1359 | MSKU1671210 | MAERSK | BAHIA | PTN | 2025-11-27 | 2025-11-28 | cerrado | embarcado | lleno | 0 |
| 1360 | BEAU5099589 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-12 | cerrado | embarcado | lleno | 35 |
| 1361 | BSIU8057519 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1362 | CAAU8271461 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-12 | cerrado | embarcado | lleno | 35 |
| 1363 | CAAU9324988 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1364 | CAJU5082558 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-17 | cerrado | embarcado | lleno | 210 |
| 1365 | FANU1808181 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1366 | FANU3508590 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1367 | FFAU2651621 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1368 | GAOU7277472 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-18 | cerrado | embarcado | lleno | 245 |
| 1369 | GCXU5677379 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-18 | cerrado | embarcado | lleno | 245 |
| 1370 | GCXU6231669 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1371 | HAMU2985580 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1372 | HAMU3470189 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1373 | HASU5027607 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1374 | HLBU1624963 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1375 | HLBU2894346 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1376 | HLXU8020197 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1377 | MRKU3759205 | MAERSK | ABBOTT | HUXLEY | 2025-11-28 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1378 | MRKU3836560 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-12 | cerrado | embarcado | lleno | 35 |
| 1379 | MSKU9439751 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-02 | cerrado | embarcado | lleno | 0 |
| 1380 | TCKU6073962 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1381 | TCLU5649120 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-03 | cerrado | embarcado | lleno | 0 |
| 1382 | TEMU7301423 | HAPAG LLOYD | BAHIA | PTN | 2025-11-28 | 2025-12-15 | cerrado | embarcado | lleno | 100 |
| 1383 | TGBU8886441 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-20 | cerrado | embarcado | lleno | 315 |
| 1384 | TRHU7550081 | MAERSK | BAHIA | PTN | 2025-11-28 | 2025-12-20 | cerrado | embarcado | lleno | 315 |
| 1385 | CAAU6390292 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1386 | CAAU9208890 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1387 | GESU6704064 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-20 | cerrado | embarcado | lleno | 210 |
| 1388 | HASU4490134 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-20 | cerrado | embarcado | lleno | 210 |
| 1389 | HASU4540810 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1390 | MRKU2840101 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1391 | MRKU2986190 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1392 | MRKU3873795 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-20 | cerrado | embarcado | lleno | 210 |
| 1393 | MRKU6241992 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1394 | MRSU3996853 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1395 | MRSU5227668 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1396 | MRSU7197773 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1397 | MSKU0770711 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-20 | cerrado | embarcado | lleno | 210 |
| 1398 | MSKU0999689 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1399 | MSKU1471192 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-20 | cerrado | embarcado | lleno | 210 |
| 1400 | PRSU8872190 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1401 | TCNU1812690 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-20 | cerrado | embarcado | lleno | 210 |
| 1402 | TRHU4029362 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1403 | TRHU8488518 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-01 | 2025-12-15 | cerrado | embarcado | lleno | 35 |
| 1404 | CAAU4982440 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1405 | CAAU6687090 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1406 | CAAU7049819 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1407 | CAAU7919919 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1408 | CAAU8472949 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1409 | CAAU9921134 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1410 | CAIU4976728 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1411 | CRSU9227100 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1412 | DFSU6664192 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1413 | FANU1826903 | HAPAG LLOYD | BAHIA | PTN | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1414 | FCIU9028992 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1415 | FFAU7191447 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1416 | FSCU7240830 | HAPAG LLOYD | BAHIA | PTN | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1417 | GAOU7084806 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1418 | GAOU7148768 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1419 | GCXU6226750 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1420 | GCXU6497561 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-23 | cerrado | embarcado | lleno | 245 |
| 1421 | HAMU1855160 | HAPAG LLOYD | BAHIA | PTN | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1422 | HASU4009466 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1423 | HASU4391152 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1424 | HASU4484532 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1425 | HASU4639320 | MAERSK | BAHIA | PTN | 2025-12-03 | 2026-01-20 | cerrado | embarcado | lleno | 1,225 |
| 1426 | HASU4664302 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1427 | HLBU2206042 | HAPAG LLOYD | BAHIA | PTN | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1428 | MIEU2004020 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1429 | MRKU2372612 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1430 | MRKU2548276 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1431 | MRKU2760388 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1432 | MRKU2917965 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1433 | MRKU3088555 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1434 | MRKU3195445 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1435 | MRKU3869990 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1436 | MRKU4018212 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1437 | MRKU4057271 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1438 | MRKU4208228 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1439 | MRKU4776038 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1440 | MRKU4865602 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1441 | MRKU5077647 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1442 | MRKU5537953 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1443 | MRKU5962989 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1444 | MRKU6206380 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1445 | MRSU3458987 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1446 | MRSU3480487 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1447 | MRSU3887087 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1448 | MRSU4433793 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1449 | MRSU5292093 | MAERSK | BAHIA | PTN | 2025-12-03 | 2026-01-27 | cerrado | embarcado | lleno | 1,470 |
| 1450 | MRSU5326932 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1451 | MRSU5879943 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1452 | MRSU6606711 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1453 | MRSU6690980 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1454 | MRSU6823297 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1455 | MRSU7228616 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1456 | MRSU7432846 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1457 | MRSU7782762 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1458 | MRSU8655274 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1459 | MRSU8759290 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2026-01-27 | cerrado | embarcado | lleno | 1,470 |
| 1460 | MSKU1043070 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1461 | MSKU9475321 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1462 | MSKU9489325 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1463 | MSKU9846274 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1464 | MSKU9873958 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1465 | SEKU6888398 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1466 | SEKU6952861 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1467 | SEKU6983918 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1468 | SUDU6717087 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-10 | cerrado | embarcado | lleno | 0 |
| 1469 | SUDU6874023 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1470 | SUDU8507860 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1471 | SUDU8547523 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1472 | SUDU8614658 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-17 | cerrado | embarcado | lleno | 35 |
| 1473 | SUDU8645303 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1474 | TCKU7694898 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1475 | TCKU7739924 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1476 | TCKU7844318 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-20 | cerrado | embarcado | lleno | 140 |
| 1477 | TCLU5195449 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-20 | cerrado | embarcado | lleno | 140 |
| 1478 | TCNU1822928 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1479 | TCNU5023940 | MAERSK | BAHIA | PTN | 2025-12-03 | 2025-12-09 | cerrado | embarcado | lleno | 0 |
| 1480 | TCNU7599745 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1481 | TCNU8444671 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1482 | TEMU6323140 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-18 | cerrado | embarcado | lleno | 70 |
| 1483 | TEMU6698337 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1484 | TGHU6818331 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1485 | TGHU9440013 | MAERSK | BAHIA | PTN | 2025-12-03 | 2026-01-27 | cerrado | embarcado | lleno | 1,470 |
| 1486 | TLLU6914611 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1487 | TRHU8325059 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-12 | cerrado | embarcado | lleno | 0 |
| 1488 | UETU6833834 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-03 | 2025-12-20 | cerrado | embarcado | lleno | 140 |
| 1489 | CAAU5462058 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-20 | cerrado | embarcado | lleno | 105 |
| 1490 | HASU4063174 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-17 | cerrado | embarcado | lleno | 0 |
| 1491 | MRKU3703886 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1492 | MRKU4087126 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1493 | MRKU6016292 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-19 | cerrado | embarcado | lleno | 70 |
| 1494 | MRSU3376425 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1495 | MRSU3466576 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-19 | cerrado | embarcado | lleno | 70 |
| 1496 | MRSU4333156 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-20 | cerrado | embarcado | lleno | 105 |
| 1497 | MRSU6063487 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-19 | cerrado | embarcado | lleno | 70 |
| 1498 | MRSU7680210 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-20 | cerrado | embarcado | lleno | 105 |
| 1499 | MRSU7800594 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1500 | MRSU8395217 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-20 | cerrado | embarcado | lleno | 105 |
| 1501 | MRSU8761086 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1502 | MSKU0175386 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-19 | cerrado | embarcado | lleno | 70 |
| 1503 | MSKU1821840 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-04 | 2025-12-20 | cerrado | embarcado | lleno | 105 |
| 1504 | CAAU6452970 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1505 | CAAU9023304 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1506 | HASU4263064 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-29 | cerrado | embarcado | lleno | 245 |
| 1507 | MRKU2745193 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1508 | MRSU3563895 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-17 | cerrado | embarcado | lleno | 0 |
| 1509 | MRSU4134880 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-17 | cerrado | embarcado | lleno | 0 |
| 1510 | MRSU4423990 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1511 | MRSU5840480 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-17 | cerrado | embarcado | lleno | 0 |
| 1512 | MRSU6377960 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1513 | MRSU8798017 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-29 | cerrado | embarcado | lleno | 245 |
| 1514 | MSKU1865391 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2026-03-02 | cerrado | embarcado | lleno | 2,450 |
| 1515 | MSKU8245387 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1516 | MVIU0024760 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1517 | TCKU7516284 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1518 | TCKU7626487 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1519 | TRHU5026563 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1520 | UETU6697419 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-09 | 2025-12-23 | cerrado | embarcado | lleno | 35 |
| 1521 | BEAU5010190 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1522 | CAAU5954084 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1523 | CAAU9968342 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2026-04-24 | cerrado | embarcado | lleno | 4,235 |
| 1524 | GAOU7085042 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1525 | GAOU7667064 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1526 | HASU4149750 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1527 | MIEU0041702 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1528 | MRKU2416834 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1529 | MRKU3055633 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2026-03-13 | cerrado | embarcado | lleno | 2,765 |
| 1530 | MRKU4022336 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1531 | MRKU5736723 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1532 | MRKU6154753 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1533 | MRSU4896000 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1534 | MRSU5038047 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1535 | MRSU5286188 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2026-03-02 | cerrado | embarcado | lleno | 2,380 |
| 1536 | MRSU6352983 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1537 | MRSU6655573 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1538 | MRSU8385707 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-18 | cerrado | embarcado | lleno | 0 |
| 1539 | MSKU0816983 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1540 | MSKU0859603 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1541 | MSKU9750017 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2026-02-27 | cerrado | embarcado | lleno | 2,275 |
| 1542 | TLLU5246098 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1543 | TRHU4803416 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-11 | 2025-12-29 | cerrado | embarcado | lleno | 175 |
| 1544 | TRHU4983350 | MAERSK | ABBOTT | HUXLEY | 2025-12-11 | 2026-01-07 | cerrado | embarcado | lleno | 490 |
| 1545 | MRKU2465248 | MAERSK | BAHIA | PTN | 2025-12-12 | 2025-12-26 | cerrado | embarcado | lleno | 35 |
| 1546 | MRSU4577574 | MAERSK | BAHIA | PTN | 2025-12-12 | 2025-12-15 | cerrado | embarcado | lleno | 0 |
| 1547 | MRSU6078430 | MAERSK | BAHIA | PTN | 2025-12-12 | 2025-12-30 | cerrado | embarcado | lleno | 175 |
| 1548 | MSKU1973694 | MAERSK | BAHIA | PTN | 2025-12-12 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1549 | SUDU8655889 | MAERSK | BAHIA | PTN | 2025-12-12 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1550 | CAAU4722295 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1551 | CAAU7184193 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1552 | CAAU9018289 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-24 | cerrado | embarcado | lleno | 0 |
| 1553 | CAIU4620594 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1554 | CAJU5013747 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1555 | GAOU7083163 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-30 | cerrado | embarcado | lleno | 140 |
| 1556 | MRKU2012262 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2026-02-20 | cerrado | embarcado | lleno | 1,960 |
| 1557 | MRKU4277131 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-24 | cerrado | embarcado | lleno | 0 |
| 1558 | MRKU5295417 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1559 | MRKU5448840 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-26 | cerrado | embarcado | lleno | 0 |
| 1560 | MRKU6409010 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1561 | MRSU4465086 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1562 | MRSU4735387 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-26 | cerrado | embarcado | lleno | 0 |
| 1563 | MRSU8682053 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1564 | SUDU8790718 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1565 | TCKU6506825 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-29 | cerrado | embarcado | lleno | 105 |
| 1566 | TCKU6950470 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-19 | cerrado | embarcado | lleno | 0 |
| 1567 | TCNU1836731 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-30 | cerrado | embarcado | lleno | 140 |
| 1568 | TCNU3017928 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-26 | cerrado | embarcado | lleno | 0 |
| 1569 | TCNU3092860 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1570 | TCNU8122211 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-26 | cerrado | embarcado | lleno | 0 |
| 1571 | UETU8138940 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-13 | 2025-12-24 | cerrado | embarcado | lleno | 0 |
| 1572 | CAAU7013708 | MAERSK | BAHIA | DEFIBE | 2025-12-15 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1573 | CAAU8599363 | MAERSK | BAHIA | DEFIBE | 2025-12-15 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1574 | HASU4840356 | MAERSK | BAHIA | DEFIBE | 2025-12-15 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1575 | MRSU3880159 | MAERSK | BAHIA | DEFIBE | 2025-12-15 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1576 | MSKU9937461 | MAERSK | BAHIA | DEFIBE | 2025-12-15 | 2025-12-23 | cerrado | embarcado | lleno | 0 |
| 1577 | BEAU6361630 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1578 | BMOU5535671 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 25 |
| 1579 | CAAU7976971 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-31 | cerrado | embarcado | lleno | 70 |
| 1580 | CAAU8401550 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1581 | CAAU8960075 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-24 | cerrado | embarcado | lleno | 0 |
| 1582 | FANU3640902 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1583 | HAMU1514190 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2026-01-20 | cerrado | embarcado | lleno | 550 |
| 1584 | HAMU2455620 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2026-01-20 | cerrado | embarcado | lleno | 550 |
| 1585 | HAMU2572566 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2026-01-20 | cerrado | embarcado | lleno | 550 |
| 1586 | HAMU2823743 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 25 |
| 1587 | HAMU2955349 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 25 |
| 1588 | HAMU3132920 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1589 | HAMU3396380 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1590 | HAMU3434915 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 25 |
| 1591 | HAMU3590380 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1592 | HASU4150807 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 35 |
| 1593 | HASU4894964 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1594 | HASU4984625 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-30 | cerrado | embarcado | lleno | 1,120 |
| 1595 | HLBU2566178 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 25 |
| 1596 | MIEU3061810 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1597 | MIEU3065903 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1598 | MRKU2271330 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1599 | MRKU2311598 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 35 |
| 1600 | MRKU5323083 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-02 | cerrado | embarcado | lleno | 140 |
| 1601 | MRSU4329578 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-29 | cerrado | embarcado | lleno | 1,085 |
| 1602 | MRSU6894053 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-02 | cerrado | embarcado | lleno | 140 |
| 1603 | MRSU7035860 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-29 | cerrado | embarcado | lleno | 1,085 |
| 1604 | MRSU8267155 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-23 | cerrado | embarcado | lleno | 875 |
| 1605 | MRSU8372736 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-31 | cerrado | embarcado | lleno | 70 |
| 1606 | MRSU8640510 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 35 |
| 1607 | MSKU1103523 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-26 | cerrado | embarcado | lleno | 980 |
| 1608 | MSKU1229065 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-29 | cerrado | embarcado | lleno | 1,085 |
| 1609 | MSKU8496464 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-29 | cerrado | embarcado | lleno | 1,085 |
| 1610 | MSKU8653516 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1611 | MSKU9155307 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1612 | MSKU9757201 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-29 | cerrado | embarcado | lleno | 1,085 |
| 1613 | SUDU6804392 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1614 | SUDU8744688 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 35 |
| 1615 | TXGU7088943 | HAPAG LLOYD | BAHIA | EXOLGAN | 2025-12-16 | 2025-12-30 | cerrado | embarcado | lleno | 25 |
| 1616 | UETU6550177 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-31 | cerrado | embarcado | lleno | 70 |
| 1617 | UETU8492378 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-02-09 | cerrado | embarcado | lleno | 1,470 |
| 1618 | UETU8502012 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2025-12-24 | cerrado | embarcado | lleno | 0 |
| 1619 | UETU8502100 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-16 | 2026-01-29 | cerrado | embarcado | lleno | 1,085 |
| 1620 | BEAU4178169 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1621 | DFSU7097149 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1622 | FANU1261812 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1623 | FANU1380724 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-29 | cerrado | embarcado | lleno | 750 |
| 1624 | FANU3215267 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1625 | FBLU0128720 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1626 | HAMU3970667 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1627 | HLBU2533702 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1628 | TCKU6452014 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1629 | TGBU9638178 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1630 | UETU5284180 | HAPAG LLOYD | BAHIA | PTN | 2025-12-17 | 2026-01-29 | cerrado | embarcado | lleno | 750 |
| 1631 | GAOU7136915 | MAERSK | BAHIA | DEFIBE | 2025-12-18 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1632 | MRSU5586760 | MAERSK | BAHIA | DEFIBE | 2025-12-18 | 2026-01-27 | cerrado | embarcado | lleno | 945 |
| 1633 | MRSU7831996 | MAERSK | BAHIA | DEFIBE | 2025-12-18 | 2026-01-26 | cerrado | embarcado | lleno | 910 |
| 1634 | SELU4004793 | MAERSK | BAHIA | DEFIBE | 2025-12-18 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1635 | UETU8111342 | MAERSK | BAHIA | DEFIBE | 2025-12-18 | 2026-01-02 | cerrado | embarcado | lleno | 70 |
| 1636 | GCXU5763590 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1637 | HASU4318296 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1638 | HASU4926341 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-20 | cerrado | embarcado | lleno | 630 |
| 1639 | MRKU0610352 | MAERSK | BAHIA | DEFIBE | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1640 | MRKU4307236 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-02 | cerrado | embarcado | lleno | 0 |
| 1641 | MRSU4394779 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-02-09 | cerrado | embarcado | lleno | 1,330 |
| 1642 | MRSU5201956 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-20 | cerrado | embarcado | lleno | 630 |
| 1643 | MRSU5683246 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-28 | cerrado | embarcado | lleno | 910 |
| 1644 | MRSU7719076 | MAERSK | BAHIA | DEFIBE | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1645 | MSKU9619970 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1646 | SUDU6658868 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-29 | cerrado | embarcado | lleno | 945 |
| 1647 | TCKU7626851 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1648 | TGBU6629589 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1649 | TRHU6291052 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-20 | cerrado | embarcado | lleno | 630 |
| 1650 | UETU7500530 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-20 | 2026-01-20 | cerrado | embarcado | lleno | 630 |
| 1651 | MRSU5338018 | MAERSK | BAHIA | DEFIBE | 2025-12-22 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1652 | MRSU8369054 | MAERSK | BAHIA | DEFIBE | 2025-12-22 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1653 | MRSU8600477 | MAERSK | BAHIA | DEFIBE | 2025-12-22 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1654 | BEAU6363464 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-29 | cerrado | embarcado | lleno | 840 |
| 1655 | BMOU5494720 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1656 | CAAU6544145 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-27 | cerrado | embarcado | lleno | 770 |
| 1657 | CAAU8610312 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-27 | cerrado | embarcado | lleno | 770 |
| 1658 | CAIU4825104 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1659 | FANU5028706 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1660 | FFAU5715118 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-27 | cerrado | embarcado | lleno | 770 |
| 1661 | HAMU1372877 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1662 | HAMU2170103 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1663 | HAMU2648445 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1664 | HAMU3263793 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1665 | HLBU2563292 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1666 | MIEU3020046 | MAERSK | BAHIA | DEFIBE | 2025-12-23 | 2026-02-19 | cerrado | embarcado | lleno | 1,575 |
| 1667 | MRKU2451080 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-27 | cerrado | embarcado | lleno | 770 |
| 1668 | MRKU2761785 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-27 | cerrado | embarcado | lleno | 770 |
| 1669 | MRKU2829777 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1670 | MRKU4483343 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-29 | cerrado | embarcado | lleno | 840 |
| 1671 | MRKU4700520 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-20 | cerrado | embarcado | lleno | 525 |
| 1672 | MRSU5193017 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-29 | cerrado | embarcado | lleno | 840 |
| 1673 | MRSU7140417 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-29 | cerrado | embarcado | lleno | 840 |
| 1674 | MRSU8187430 | MAERSK | BAHIA | DEFIBE | 2025-12-23 | 2026-02-20 | cerrado | embarcado | lleno | 1,610 |
| 1675 | MRSU8409558 | MAERSK | BAHIA | DEFIBE | 2025-12-23 | 2026-02-19 | cerrado | embarcado | lleno | 1,575 |
| 1676 | PONU7696621 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-27 | cerrado | embarcado | lleno | 770 |
| 1677 | TCLU5591856 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1678 | TCNU1343910 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-23 | 2026-01-26 | cerrado | embarcado | lleno | 735 |
| 1679 | TGBU5921750 | HAPAG LLOYD | BAHIA | PTN | 2025-12-23 | 2025-12-29 | cerrado | embarcado | lleno | 0 |
| 1680 | CAAU5772562 | MAERSK | BAHIA | DEFIBE | 2025-12-26 | 2026-01-20 | cerrado | embarcado | lleno | 420 |
| 1681 | MRKU4929498 | MAERSK | BAHIA | DEFIBE | 2025-12-26 | 2026-01-27 | cerrado | embarcado | lleno | 665 |
| 1682 | TCNU1117173 | MAERSK | ABBOTT | HUXLEY | 2025-12-26 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1683 | TGHU6885772 | MAERSK | ABBOTT | HUXLEY | 2025-12-26 | 2026-01-07 | cerrado | embarcado | lleno | 0 |
| 1684 | MRKU4342849 | MAERSK | BAHIA | DEFIBE | 2025-12-27 | 2026-02-11 | cerrado | embarcado | lleno | 1,155 |
| 1685 | DFSU6488025 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-02 | cerrado | embarcado | lleno | 0 |
| 1686 | FJKU6005720 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-02 | cerrado | embarcado | lleno | 0 |
| 1687 | HASU4498536 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-31 | cerrado | embarcado | lleno | 0 |
| 1688 | HASU4872862 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-31 | cerrado | embarcado | lleno | 700 |
| 1689 | MRKU2857064 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-31 | cerrado | embarcado | lleno | 0 |
| 1690 | MRKU3359826 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-27 | cerrado | embarcado | lleno | 560 |
| 1691 | MRKU3997610 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-20 | cerrado | embarcado | lleno | 315 |
| 1692 | MRKU5381285 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-20 | cerrado | embarcado | lleno | 315 |
| 1693 | MRKU6376257 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-26 | cerrado | embarcado | lleno | 525 |
| 1694 | MRSU3302485 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1695 | MRSU3686673 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1696 | MRSU5276385 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1697 | MRSU6555065 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-31 | cerrado | embarcado | lleno | 0 |
| 1698 | MRSU7868980 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-27 | cerrado | embarcado | lleno | 560 |
| 1699 | MSKU1663810 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-30 | cerrado | embarcado | lleno | 0 |
| 1700 | SELU4093379 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-31 | cerrado | embarcado | lleno | 0 |
| 1701 | TCKU6593795 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-31 | cerrado | embarcado | lleno | 0 |
| 1702 | TCNU2883255 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-02 | cerrado | embarcado | lleno | 0 |
| 1703 | TEMU6996291 | MAERSK | BAHIA | PTN | 2025-12-29 | 2025-12-31 | cerrado | embarcado | lleno | 0 |
| 1704 | TGBU9323036 | MAERSK | BAHIA | PTN | 2025-12-29 | 2026-01-29 | cerrado | embarcado | lleno | 630 |
| 1705 | BEAU5737410 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-03-30 | cerrado | embarcado | lleno | 2,695 |
| 1706 | BHCU4990353 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-02-10 | cerrado | embarcado | lleno | 1,015 |
| 1707 | CAAU6416144 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-26 | cerrado | embarcado | lleno | 490 |
| 1708 | HASU4792073 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1709 | HASU5074810 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-28 | cerrado | embarcado | lleno | 560 |
| 1710 | MRKU2037105 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-02-19 | cerrado | embarcado | lleno | 1,330 |
| 1711 | MRKU2874610 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-02-20 | cerrado | embarcado | lleno | 1,365 |
| 1712 | MRKU3052980 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-29 | cerrado | embarcado | lleno | 595 |
| 1713 | MRKU4379616 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1714 | MRKU4479127 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-29 | cerrado | embarcado | lleno | 595 |
| 1715 | MRSU4126518 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1716 | MRSU5615318 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-29 | cerrado | embarcado | lleno | 595 |
| 1717 | MRSU5843236 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1718 | MRSU7313256 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-02-09 | cerrado | embarcado | lleno | 980 |
| 1719 | MRSU8311710 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-29 | cerrado | embarcado | lleno | 595 |
| 1720 | MRSU8686850 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1721 | MSKU1500198 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1722 | MSKU9846417 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1723 | SEKU6955623 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-26 | cerrado | embarcado | lleno | 490 |
| 1724 | TCKU7444060 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-28 | cerrado | embarcado | lleno | 560 |
| 1725 | TCLU5757865 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-28 | cerrado | embarcado | lleno | 560 |
| 1726 | TCNU2286692 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-03-17 | cerrado | embarcado | lleno | 2,240 |
| 1727 | TRHU5299383 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-20 | cerrado | embarcado | lleno | 280 |
| 1728 | UETU5708550 | MAERSK | BAHIA | TERMINAL 4 | 2025-12-30 | 2026-01-27 | cerrado | embarcado | lleno | 525 |
| 1729 | CAAU9067468 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-03-02 | cerrado | embarcado | lleno | 1,610 |
| 1730 | CAAU9308230 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-27 | cerrado | embarcado | lleno | 420 |
| 1731 | CIPU5213095 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-23 | cerrado | embarcado | lleno | 280 |
| 1732 | FFAU7425530 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-29 | cerrado | embarcado | lleno | 490 |
| 1733 | GESU5853931 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-27 | cerrado | embarcado | lleno | 420 |
| 1734 | GESU6206159 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-27 | cerrado | embarcado | lleno | 420 |
| 1735 | HASU4098714 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-02-19 | cerrado | embarcado | lleno | 1,225 |
| 1736 | HASU4271352 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1737 | HASU4332695 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-26 | cerrado | embarcado | lleno | 385 |
| 1738 | MRKU4626547 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1739 | MRKU4667660 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-01-29 | cerrado | embarcado | lleno | 490 |
| 1740 | MRKU4748904 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-27 | cerrado | embarcado | lleno | 420 |
| 1741 | MRKU4955835 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-23 | cerrado | devuelto_vacio | vacio | 280 |
| 1742 | MRKU5467012 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-23 | cerrado | embarcado | lleno | 280 |
| 1743 | MRKU5793385 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-02-20 | cerrado | embarcado | lleno | 1,260 |
| 1744 | MRKU5800864 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-01-26 | cerrado | embarcado | lleno | 385 |
| 1745 | MRSU3375521 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1746 | MRSU4808673 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1747 | MRSU6707300 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-02-09 | cerrado | embarcado | lleno | 875 |
| 1748 | MRSU7884091 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1749 | MRSU8255236 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-23 | cerrado | embarcado | lleno | 280 |
| 1750 | SEKU4592555 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-01-29 | cerrado | embarcado | lleno | 490 |
| 1751 | SUDU8729003 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1752 | SUDU8797707 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-26 | cerrado | embarcado | lleno | 385 |
| 1753 | SUDU8926912 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1754 | TCKU6567477 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-28 | cerrado | embarcado | lleno | 455 |
| 1755 | TCKU6737167 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-02-24 | cerrado | embarcado | lleno | 1,400 |
| 1756 | TCKU7009377 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-03-02 | cerrado | embarcado | lleno | 1,610 |
| 1757 | TGBU5379422 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-01-16 | cerrado | embarcado | lleno | 35 |
| 1758 | TGHU9723013 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-01-20 | cerrado | embarcado | lleno | 175 |
| 1759 | TLLU5959838 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-02 | 2026-02-10 | cerrado | embarcado | lleno | 910 |
| 1760 | TRHU6325337 | MAERSK | BAHIA | PTN | 2026-01-02 | 2026-01-29 | cerrado | embarcado | lleno | 490 |
| 1761 | MRSU3710390 | MAERSK | ABBOTT | DEFIBE | 2026-01-06 | 2026-01-09 | cerrado | embarcado | lleno | 0 |
| 1762 | TGHU5252722 | ZIM LINES | ABBOTT | HIPERBAIRES | 2026-01-06 | 2026-01-09 | cerrado | embarcado | lleno | 0 |
| 1763 | ZIMU1022976 | ZIM LINES | ABBOTT | HIPERBAIRES | 2026-01-06 | 2026-01-09 | cerrado | embarcado | lleno | 0 |
| 1764 | CAAU4620056 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1765 | CAAU5148330 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1766 | CAAU5317661 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1767 | CAAU8455540 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1768 | DFSU7585225 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-31 | cerrado | embarcado | lleno | 0 |
| 1769 | FANU3384800 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1770 | HAMU3056435 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1771 | HAMU3090677 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1772 | HAMU4366559 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-31 | cerrado | embarcado | lleno | 0 |
| 1773 | HASU4084433 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1774 | HASU4720999 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1775 | MRKU4055900 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1776 | MRKU4816423 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1777 | MRKU5102945 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1778 | MRKU6104860 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1779 | MRKU6162506 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1780 | MRSU3692953 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1781 | MRSU4035254 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1782 | MRSU4291148 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1783 | MRSU4829249 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1784 | MRSU5777392 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-02-10 | cerrado | embarcado | lleno | 280 |
| 1785 | MSKU1715787 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1786 | MTSU9672897 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1787 | SEKU4714210 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1788 | SEKU6872175 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1789 | SUDU6923508 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1790 | TCKU7390663 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1791 | TCNU1899365 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1792 | TCNU8809255 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1793 | TLLU5370750 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1794 | TRHU5634795 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1795 | TRHU6288974 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1796 | TRHU8358920 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-20 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1797 | UETU6741980 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-01-20 | 2026-01-31 | cerrado | embarcado | lleno | 0 |
| 1798 | BEAU5897871 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1799 | CAAU5940291 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1800 | CAAU6586562 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1801 | CAAU6600531 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1802 | CAIU9636470 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1803 | CAJU5087288 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1804 | FFAU5617370 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-30 | cerrado | embarcado | lleno | 0 |
| 1805 | GCXU5701984 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1806 | HASU4592769 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1807 | MRKU2419540 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-26 | cerrado | embarcado | lleno | 0 |
| 1808 | MRKU2730125 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1809 | MRKU3397533 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1810 | MRKU4860895 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1811 | MRKU4885023 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1812 | MRKU4953112 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1813 | MRKU5150481 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1814 | MRSU3758710 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1815 | MRSU4386201 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1816 | MRSU5112490 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-31 | cerrado | embarcado | lleno | 0 |
| 1817 | MRSU7354471 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1818 | MSKU0924231 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-30 | cerrado | embarcado | lleno | 0 |
| 1819 | MSKU1182034 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-30 | cerrado | embarcado | lleno | 0 |
| 1820 | MSKU1869782 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-31 | cerrado | embarcado | lleno | 0 |
| 1821 | SEKU4608836 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1822 | SELU4119046 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1823 | SUDU6990830 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-30 | cerrado | embarcado | lleno | 0 |
| 1824 | SUDU8791020 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1825 | TCKU6967452 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1826 | TCKU7202160 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1827 | TCKU7845530 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1828 | TCLU5647359 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-09 | cerrado | embarcado | lleno | 140 |
| 1829 | TCNU6934900 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-31 | cerrado | embarcado | lleno | 0 |
| 1830 | TRHU4085690 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1831 | TRHU7234150 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1832 | UETU7290080 | MAERSK | BAHIA | PTN | 2026-01-23 | 2026-02-02 | cerrado | embarcado | lleno | 0 |
| 1833 | SEKU6970736 | MAERSK | BAHIA | PTN | 2026-01-26 | 2026-01-29 | cerrado | embarcado | lleno | 0 |
| 1834 | TCKU6465177 | MAERSK | BAHIA | PTN | 2026-01-26 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1835 | TGBU9358095 | MAERSK | BAHIA | PTN | 2026-01-26 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1836 | TLLU5888950 | MAERSK | BAHIA | PTN | 2026-01-26 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1837 | UETU8116410 | MAERSK | BAHIA | PTN | 2026-01-26 | 2026-01-27 | cerrado | embarcado | lleno | 0 |
| 1838 | MRKU2872541 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1839 | MRKU3076554 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1840 | MRKU5139610 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-19 | cerrado | embarcado | lleno | 350 |
| 1841 | MRKU5704813 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1842 | MRSU4062835 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1843 | MRSU5436230 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1844 | MRSU7117567 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1845 | MSKU9973181 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1846 | SUDU8987414 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-03-02 | cerrado | embarcado | lleno | 735 |
| 1847 | TRHU7449630 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-27 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1848 | CAAU6497697 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-19 | cerrado | embarcado | lleno | 280 |
| 1849 | CAAU7060994 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1850 | CAAU8427127 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1851 | CIPU5084850 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1852 | MRKU2145310 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1853 | MRKU6245220 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1854 | MRKU6338010 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-19 | cerrado | embarcado | lleno | 280 |
| 1855 | MRSU4809659 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1856 | MRSU4880430 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1857 | MRSU5790157 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1858 | MRSU6087940 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1859 | MRSU6985451 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1860 | MRSU8499628 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1861 | MSKU9540134 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1862 | SUDU6586161 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1863 | TGHU6095253 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1864 | TRHU4535123 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-23 | cerrado | embarcado | lleno | 420 |
| 1865 | XINU8200238 | MAERSK | BAHIA | TERMINAL 4 | 2026-01-29 | 2026-02-20 | cerrado | embarcado | lleno | 315 |
| 1866 | CAJU5016690 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-03-02 | cerrado | embarcado | lleno | 630 |
| 1867 | GAOU7349546 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-02-09 | cerrado | embarcado | lleno | 0 |
| 1868 | HASU4727057 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-02-19 | cerrado | embarcado | lleno | 245 |
| 1869 | MRKU4992206 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1870 | MRSU6841161 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-03-02 | cerrado | embarcado | lleno | 630 |
| 1871 | MSKU1770573 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-02-10 | cerrado | embarcado | lleno | 0 |
| 1872 | TRHU5663772 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-02-19 | cerrado | embarcado | lleno | 245 |
| 1873 | TRHU6290502 | MAERSK | BAHIA | PTN | 2026-01-30 | 2026-02-19 | cerrado | embarcado | lleno | 245 |
| 1874 | SUDU6778360 | MAERSK | BAHIA | PTN | 2026-01-31 | 2026-02-19 | cerrado | embarcado | lleno | 210 |
| 1875 | TRHU4987289 | MAERSK | BAHIA | PTN | 2026-01-31 | 2026-02-19 | cerrado | embarcado | lleno | 210 |
| 1876 | HASU4563930 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1877 | HASU4791014 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1878 | MRKU3310934 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1879 | MRKU6030958 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1880 | MSKU0565614 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1881 | MSKU8563140 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1882 | SEKU4473962 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1883 | TCKU6835712 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1884 | TCKU6896683 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1885 | TCNU1476018 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1886 | TCNU2627211 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1887 | TEMU8384952 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1888 | TGBU9303913 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-03 | 2026-02-19 | cerrado | embarcado | lleno | 105 |
| 1889 | BEAU4459865 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1890 | BMOU5888365 | MAERSK | BAHIA | HUXLEY | 2026-02-06 | 2026-02-11 | cerrado | embarcado | lleno | 0 |
| 1891 | FANU1921710 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1892 | FANU3619422 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1893 | FANU3649140 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1894 | GAOU7062411 | MAERSK | BAHIA | HUXLEY | 2026-02-06 | 2026-02-11 | cerrado | embarcado | lleno | 0 |
| 1895 | GCXU5074354 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1896 | GCXU5972883 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1897 | HAMU2168620 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1898 | HAMU2292098 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1899 | HAMU4147714 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1900 | HLBU2003343 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1901 | TRHU4979154 | HAPAG LLOYD | BAHIA | PTN | 2026-02-06 | 2026-02-24 | cerrado | embarcado | lleno | 125 |
| 1902 | HASU4804430 | MAERSK | BAHIA | HUXLEY | 2026-02-09 | 2026-02-11 | cerrado | embarcado | lleno | 0 |
| 1903 | MSKU0057948 | MAERSK | BAHIA | HUXLEY | 2026-02-09 | 2026-02-11 | cerrado | embarcado | lleno | 0 |
| 1904 | TEMU6283665 | MAERSK | BAHIA | HUXLEY | 2026-02-09 | 2026-02-11 | cerrado | embarcado | lleno | 0 |
| 1905 | GCXU5562317 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1906 | HASU4289454 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1907 | HASU5003591 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-23 | cerrado | embarcado | lleno | 0 |
| 1908 | MRKU2318186 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1909 | MRKU2754298 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-19 | cerrado | embarcado | lleno | 0 |
| 1910 | MRKU4078103 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-23 | cerrado | embarcado | lleno | 0 |
| 1911 | MRKU4339172 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1912 | MRKU4720553 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-03 | cerrado | embarcado | lleno | 280 |
| 1913 | MRKU4876090 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-26 | cerrado | embarcado | lleno | 105 |
| 1914 | MRKU5352029 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-19 | cerrado | embarcado | lleno | 0 |
| 1915 | MRKU6213265 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-27 | cerrado | embarcado | lleno | 140 |
| 1916 | MRSU3095156 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-23 | cerrado | embarcado | lleno | 0 |
| 1917 | MRSU3238318 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-19 | cerrado | embarcado | lleno | 0 |
| 1918 | MRSU3796080 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1919 | MRSU4010488 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1920 | MRSU5796155 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1921 | MRSU6011689 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-24 | cerrado | embarcado | lleno | 35 |
| 1922 | MRSU7372053 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-02 | cerrado | embarcado | lleno | 245 |
| 1923 | MRSU7836489 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-03-03 | cerrado | embarcado | lleno | 280 |
| 1924 | MRSU8146220 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-27 | cerrado | embarcado | lleno | 140 |
| 1925 | TCKU6854230 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-23 | cerrado | embarcado | lleno | 0 |
| 1926 | TCLU9273128 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-19 | cerrado | embarcado | lleno | 0 |
| 1927 | TXGU5265124 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-10 | 2026-02-24 | cerrado | embarcado | lleno | 35 |
| 1928 | CAAU7936752 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-02-27 | cerrado | embarcado | lleno | 105 |
| 1929 | CAAU9821449 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-02-27 | cerrado | embarcado | lleno | 105 |
| 1930 | MRKU3893976 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-03-03 | cerrado | embarcado | lleno | 245 |
| 1931 | MRKU5420838 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-02-27 | cerrado | embarcado | lleno | 105 |
| 1932 | MRKU5733724 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-02-27 | cerrado | embarcado | lleno | 105 |
| 1933 | MRSU4150221 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-02-27 | cerrado | embarcado | lleno | 105 |
| 1934 | MRSU6149111 | MAERSK | ABBOTT | GAMMA LOGISTICA | 2026-02-11 | 2026-03-09 | cerrado | embarcado | lleno | 455 |
| 1935 | MRSU7934295 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-04-14 | cerrado | embarcado | lleno | 1,715 |
| 1936 | SUDU5835470 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-02-27 | cerrado | embarcado | lleno | 105 |
| 1937 | TCKU7173740 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-11 | 2026-03-13 | cerrado | embarcado | lleno | 595 |
| 1938 | TRHU4807047 | MAERSK | ABBOTT | GAMMA LOGISTICA | 2026-02-11 | 2026-02-26 | cerrado | embarcado | lleno | 70 |
| 1939 | MRSU8074916 | MAERSK | ABBOTT | DEFIBE | 2026-02-12 | 2026-03-12 | cerrado | embarcado | lleno | 525 |
| 1940 | MRSU7488260 | MAERSK | ABBOTT | DEFIBE | 2026-02-13 | 2026-03-12 | cerrado | embarcado | lleno | 490 |
| 1941 | BSIU8083800 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1942 | CAJU5230716 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-06 | cerrado | embarcado | lleno | 70 |
| 1943 | FFAU2348410 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1944 | HASU4593889 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-06 | cerrado | embarcado | lleno | 70 |
| 1945 | MRKU2100888 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1946 | MRKU2404392 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-13 | cerrado | embarcado | lleno | 315 |
| 1947 | MRKU2838059 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-31 | cerrado | embarcado | lleno | 945 |
| 1948 | MRKU3111697 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1949 | MRKU4078248 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-06 | cerrado | embarcado | lleno | 70 |
| 1950 | MRSU3637832 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-17 | cerrado | embarcado | lleno | 455 |
| 1951 | MRSU3854252 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-13 | cerrado | embarcado | lleno | 315 |
| 1952 | MRSU5890135 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1953 | MRSU6441442 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1954 | MRSU6593595 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1955 | MRSU7974364 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-13 | cerrado | embarcado | lleno | 315 |
| 1956 | MRSU8778330 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1957 | MRSU8961741 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1958 | SELU4068632 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-16 | cerrado | embarcado | lleno | 420 |
| 1959 | SUDU8630880 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-23 | cerrado | embarcado | lleno | 665 |
| 1960 | TCNU2873180 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1961 | TEMU6683867 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1962 | TLLU5953465 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-06 | cerrado | embarcado | lleno | 70 |
| 1963 | TRHU6212393 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-10 | cerrado | embarcado | lleno | 210 |
| 1964 | TRHU7695613 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1965 | UETU8049734 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-19 | 2026-03-06 | cerrado | embarcado | lleno | 70 |
| 1966 | MRKU3371225 | MAERSK | BAHIA | PTN | 2026-02-20 | 2026-04-06 | cerrado | embarcado | lleno | 1,120 |
| 1967 | CAAU6775545 | MAERSK | BAHIA | PTN | 2026-02-23 | 2026-03-13 | cerrado | embarcado | lleno | 175 |
| 1968 | MSKU1342240 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-23 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 1969 | SUDU6614638 | MAERSK | BAHIA | PTN | 2026-02-23 | 2026-03-10 | cerrado | embarcado | lleno | 70 |
| 1970 | TCNU5231693 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-23 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 1971 | TCNU8239276 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-23 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 1972 | TCNU8597135 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-23 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 1973 | TGBU9323210 | MAERSK | BAHIA | PTN | 2026-02-23 | 2026-03-13 | cerrado | embarcado | lleno | 175 |
| 1974 | TXGU5260009 | MAERSK | BAHIA | TERMINAL 4 | 2026-02-23 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 1975 | BEAU5093174 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1976 | CAJU5087971 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1977 | CAJU5094688 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-10 | cerrado | embarcado | lleno | 35 |
| 1978 | CAJU5126640 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-02-28 | cerrado | embarcado | lleno | 0 |
| 1979 | FFAU5666564 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-10 | cerrado | embarcado | lleno | 35 |
| 1980 | FFAU7142083 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-10 | cerrado | embarcado | lleno | 35 |
| 1981 | FFAU7698730 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-10 | cerrado | embarcado | lleno | 35 |
| 1982 | MRSU3044550 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-10 | cerrado | embarcado | lleno | 35 |
| 1983 | MRSU6485250 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1984 | MRSU7627787 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1985 | TRHU4057662 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-10 | cerrado | embarcado | lleno | 35 |
| 1986 | UETU8445376 | MAERSK | BAHIA | PTN | 2026-02-24 | 2026-03-23 | cerrado | embarcado | lleno | 490 |
| 1987 | BMOU5627567 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 1988 | BMOU6627915 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1989 | CAIU4246118 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 1990 | CIPU5269026 | MAERSK | BAHIA | PTN | 2026-02-25 | 2026-02-27 | cerrado | embarcado | lleno | 0 |
| 1991 | CXDU1838010 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1992 | FANU1785830 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1993 | FANU3057963 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1994 | FDCU0105167 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 1995 | FFAU1792559 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 1996 | FSCU7148088 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 1997 | FSCU8416354 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1998 | HLBU1011827 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 1999 | HLBU1968383 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-26 | cerrado | embarcado | lleno | 400 |
| 2000 | HLBU2904552 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2001 | HLBU3130553 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2002 | HLXU8535799 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2003 | MRSU5340674 | MAERSK | BAHIA | PTN | 2026-02-25 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 2004 | MRSU5351107 | MAERSK | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2005 | MRSU5587237 | MAERSK | ABBOTT | HUXLEY | 2026-02-25 | 2026-03-12 | cerrado | embarcado | lleno | 70 |
| 2006 | NIDU5205961 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2007 | SEGU5654410 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2008 | SEGU5706350 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2009 | SEKU4627918 | MAERSK | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2010 | TCKU7460879 | MAERSK | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2011 | TGBU5863967 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2012 | UETU5251000 | HAPAG LLOYD | BAHIA | PTN | 2026-02-25 | 2026-02-26 | cerrado | embarcado | lleno | 0 |
| 2013 | UETU6615787 | HAPAG LLOYD | BAHIA | EXOLGAN | 2026-02-25 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2014 | FFAU7254057 | MAERSK | BAHIA | PTN | 2026-02-27 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 2015 | MRSU3096912 | MAERSK | BAHIA | PTN | 2026-02-27 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2016 | MRSU4195993 | MAERSK | BAHIA | PTN | 2026-02-27 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2017 | MRSU5254452 | MAERSK | BAHIA | PTN | 2026-02-27 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 2018 | TCNU2872348 | MAERSK | BAHIA | PTN | 2026-02-27 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2019 | UETU8199478 | MAERSK | BAHIA | PTN | 2026-02-27 | 2026-03-03 | cerrado | embarcado | lleno | 0 |
| 2020 | MRKU2372567 | MAERSK | BAHIA | DEFIBE | 2026-03-02 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2021 | MRSU4017939 | MAERSK | BAHIA | DEFIBE | 2026-03-02 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2022 | MRSU6324997 | MAERSK | BAHIA | DEFIBE | 2026-03-02 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2023 | MRSU8522862 | MAERSK | BAHIA | DEFIBE | 2026-03-02 | 2026-03-23 | cerrado | embarcado | lleno | 280 |
| 2024 | SUDU8940700 | MAERSK | BAHIA | DEFIBE | 2026-03-02 | 2026-03-30 | cerrado | embarcado | lleno | 525 |
| 2025 | TLLU6908270 | MAERSK | BAHIA | DEFIBE | 2026-03-02 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2026 | AXIU1963573 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2027 | CAAU5275118 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2028 | CAAU5954232 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-31 | cerrado | embarcado | lleno | 525 |
| 2029 | CAAU8882481 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2030 | CAAU9207451 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-23 | cerrado | embarcado | lleno | 245 |
| 2031 | CLHU9090413 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-31 | cerrado | embarcado | lleno | 525 |
| 2032 | FFAU4766620 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2033 | HASU4264522 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2034 | HASU4416116 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-31 | cerrado | embarcado | lleno | 525 |
| 2035 | HASU4418103 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2036 | HASU4853559 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-04-21 | cerrado | embarcado | lleno | 1,260 |
| 2037 | HASU4921674 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-25 | cerrado | embarcado | lleno | 315 |
| 2038 | HASU5020109 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-04-21 | cerrado | embarcado | lleno | 1,260 |
| 2039 | HASU5173812 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-06-03 | cerrado | embarcado | lleno | 2,765 |
| 2040 | MRKU2522991 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2041 | MRKU4019498 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2042 | MRKU4190812 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-31 | cerrado | embarcado | lleno | 525 |
| 2043 | MRKU4262790 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2044 | MRKU5220470 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2045 | MRKU5585165 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-05-05 | cerrado | embarcado | lleno | 1,750 |
| 2046 | MRKU5954094 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-31 | cerrado | embarcado | lleno | 525 |
| 2047 | MRKU6196379 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-31 | cerrado | embarcado | lleno | 525 |
| 2048 | MRSU5316153 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2049 | MRSU5640408 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2050 | MRSU6467724 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2051 | MRSU6640104 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-23 | cerrado | embarcado | lleno | 245 |
| 2052 | MRSU7810334 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2053 | MRSU8299954 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2054 | MRSU9048594 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-04-09 | cerrado | embarcado | lleno | 840 |
| 2055 | TCKU6727385 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2056 | TCKU6876732 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2057 | TCKU7205209 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2058 | TCKU7853412 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2059 | TCKU7915366 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-05-08 | cerrado | embarcado | lleno | 1,855 |
| 2060 | TCLU5959085 | MAERSK | BAHIA | PTN | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2061 | TCLU8738832 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-10 | cerrado | embarcado | lleno | 0 |
| 2062 | TCNU1814584 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2063 | TCNU2056107 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2064 | TCNU2627464 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2065 | TLLU4732860 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2066 | TLLU8132479 | MAERSK | BAHIA | DEFIBE | 2026-03-03 | 2026-03-20 | cerrado | embarcado | lleno | 140 |
| 2067 | TRHU4808568 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-03 | 2026-03-17 | cerrado | embarcado | lleno | 35 |
| 2068 | CAAU8507691 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-03-23 | cerrado | embarcado | lleno | 175 |
| 2069 | CIPU5076140 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-04-28 | cerrado | embarcado | lleno | 1,435 |
| 2070 | HASU4280307 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2071 | HASU4514848 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2072 | MRKU3330226 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2073 | MRKU3528588 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-25 | cerrado | embarcado | lleno | 245 |
| 2074 | MRKU3894036 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-23 | cerrado | embarcado | lleno | 175 |
| 2075 | MRKU4304181 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2076 | MRKU4755713 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2077 | MRKU4821712 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2078 | MRKU4828851 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2079 | MRKU5606036 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2080 | MRKU5713590 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2081 | MRKU5950782 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-03-30 | cerrado | embarcado | lleno | 420 |
| 2082 | MRSU4507730 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2083 | MRSU5107071 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2084 | MRSU5367844 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-04-13 | cerrado | embarcado | lleno | 910 |
| 2085 | MRSU5463468 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2086 | MRSU5890074 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2087 | MRSU5892863 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-12 | cerrado | embarcado | lleno | 0 |
| 2088 | MRSU7023961 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2089 | MRSU7625892 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2090 | MRSU7910729 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2091 | MRSU8280373 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-04-21 | cerrado | embarcado | lleno | 1,190 |
| 2092 | MSKU0705090 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-04-21 | cerrado | embarcado | lleno | 1,190 |
| 2093 | MSKU1499815 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2094 | MSKU1802773 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-04-06 | cerrado | embarcado | lleno | 665 |
| 2095 | MSKU1926331 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-04-07 | cerrado | embarcado | lleno | 700 |
| 2096 | PONU8013592 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2097 | SEKU4631374 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-20 | cerrado | embarcado | lleno | 70 |
| 2098 | SELU4105696 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-04-21 | cerrado | embarcado | lleno | 1,190 |
| 2099 | SUDU8790430 | MAERSK | BAHIA | DEFIBE | 2026-03-05 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2100 | TCNU1454940 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-25 | cerrado | embarcado | lleno | 245 |
| 2101 | TLLU5981277 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-17 | cerrado | embarcado | lleno | 0 |
| 2102 | TLLU6907947 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-25 | cerrado | embarcado | lleno | 245 |
| 2103 | TRHU4806605 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-03-31 | cerrado | embarcado | lleno | 455 |
| 2104 | TRHU7615747 | MAERSK | BAHIA | PTN | 2026-03-05 | 2026-04-21 | cerrado | embarcado | lleno | 1,190 |
| 2105 | FSCU8317367 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-30 | cerrado | embarcado | lleno | 385 |
| 2106 | HASU5055023 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-31 | cerrado | embarcado | lleno | 420 |
| 2107 | MRKU1085808 | MAERSK | BAHIA | DEFIBE | 2026-03-06 | 2026-03-23 | cerrado | embarcado | lleno | 140 |
| 2108 | MRKU3456467 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2109 | MRKU4059926 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2110 | MRKU5821337 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2111 | MRKU6288937 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-30 | cerrado | embarcado | lleno | 385 |
| 2112 | MRKU6307106 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-25 | cerrado | embarcado | lleno | 210 |
| 2113 | MRSU3771986 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-31 | cerrado | embarcado | lleno | 420 |
| 2114 | MRSU7321884 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-31 | cerrado | embarcado | lleno | 420 |
| 2115 | MRSU8128925 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-31 | cerrado | embarcado | lleno | 420 |
| 2116 | MRSU8509270 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2117 | MRSU8951595 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-25 | cerrado | embarcado | lleno | 210 |
| 2118 | MSKU1452377 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-31 | cerrado | embarcado | lleno | 420 |
| 2119 | PONU8198618 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2120 | SUDU8603930 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-03-31 | cerrado | embarcado | lleno | 420 |
| 2121 | TRLU7620778 | MAERSK | BAHIA | PTN | 2026-03-06 | 2026-04-28 | cerrado | embarcado | lleno | 1,400 |
| 2122 | CAAU5394056 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2123 | CIPU5235134 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-25 | cerrado | embarcado | lleno | 175 |
| 2124 | FFAU5311815 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2125 | GCXU6498906 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-04-08 | cerrado | embarcado | lleno | 665 |
| 2126 | HASU4017245 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-30 | cerrado | embarcado | lleno | 350 |
| 2127 | MRKU0276292 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2128 | MRKU0327002 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2129 | MRKU0755551 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2130 | MRKU1050442 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2131 | MRKU2794881 | MAERSK | ABBOTT | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2132 | MRKU4670703 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2133 | MRKU4686058 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2134 | MRSU3042979 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-04-09 | cerrado | embarcado | lleno | 700 |
| 2135 | MRSU4217310 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-04-21 | cerrado | embarcado | lleno | 1,120 |
| 2136 | MRSU6007992 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2137 | MRSU6508633 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-30 | cerrado | embarcado | lleno | 350 |
| 2138 | MRSU8000030 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-04-08 | cerrado | embarcado | lleno | 665 |
| 2139 | MRSU8971591 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-30 | cerrado | embarcado | lleno | 350 |
| 2140 | MSKU6962310 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2141 | SUDU8512851 | MAERSK | ABBOTT | DEFIBE | 2026-03-07 | 2026-03-31 | cerrado | embarcado | lleno | 385 |
| 2142 | TCLU8658608 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-30 | cerrado | embarcado | lleno | 350 |
| 2143 | TGBU6815768 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-23 | cerrado | embarcado | lleno | 105 |
| 2144 | TIIU5295974 | MAERSK | ABBOTT | DEFIBE | 2026-03-07 | 2026-03-31 | cerrado | embarcado | lleno | 385 |
| 2145 | TRHU4550160 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-07 | 2026-03-25 | cerrado | embarcado | lleno | 175 |
| 2146 | TRHU5093767 | MAERSK | BAHIA | DEFIBE | 2026-03-07 | 2026-03-30 | cerrado | embarcado | lleno | 350 |
| 2147 | UETU7842091 | MAERSK | ABBOTT | DEFIBE | 2026-03-07 | 2026-03-31 | cerrado | embarcado | lleno | 385 |
| 2148 | CAAU9315820 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2149 | CIPU5235406 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2150 | FFAU5173207 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2151 | FFAU7189856 | MAERSK | ABBOTT | DEFIBE | 2026-03-09 | 2026-04-09 | cerrado | embarcado | lleno | 630 |
| 2152 | HASU5052364 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2153 | MRKU0030502 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-05-08 | cerrado | embarcado | lleno | 1,645 |
| 2154 | MRKU0468063 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-05-08 | cerrado | embarcado | lleno | 1,645 |
| 2155 | MRKU0601936 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-03-23 | cerrado | embarcado | lleno | 35 |
| 2156 | MRKU0672251 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-05-28 | cerrado | embarcado | lleno | 2,345 |
| 2157 | MRKU0801805 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-03-23 | cerrado | embarcado | lleno | 35 |
| 2158 | MRKU2948586 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-04-22 | cerrado | embarcado | lleno | 1,085 |
| 2159 | MRKU3039231 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2160 | MRKU5542184 | MAERSK | ABBOTT | HUXLEY | 2026-03-09 | 2026-03-18 | cerrado | embarcado | lleno | 0 |
| 2161 | MRKU5849864 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-04-13 | cerrado | embarcado | lleno | 770 |
| 2162 | MRKU6033725 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2163 | MRKU6321151 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-23 | cerrado | embarcado | lleno | 35 |
| 2164 | MRKU6367506 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-04-22 | cerrado | embarcado | lleno | 1,085 |
| 2165 | MRSU4721510 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2166 | MRSU5546069 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-04-22 | cerrado | embarcado | lleno | 1,085 |
| 2167 | MRSU5922931 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-04-24 | cerrado | embarcado | lleno | 1,155 |
| 2168 | MRSU6070444 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2169 | MRSU6095740 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-30 | cerrado | embarcado | lleno | 280 |
| 2170 | MRSU7883074 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-31 | cerrado | embarcado | lleno | 315 |
| 2171 | MRSU9196924 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2172 | MSKU9608234 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2173 | SEGU5042667 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-04-22 | cerrado | embarcado | lleno | 1,085 |
| 2174 | TCKU6155187 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2175 | TCKU7381867 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2176 | TCNU1094587 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2177 | TCNU8389229 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2178 | TIIU5539915 | MAERSK | BAHIA | DEFIBE | 2026-03-09 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2179 | UETU6413343 | MAERSK | BAHIA | PTN | 2026-03-09 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2180 | FSCU8276571 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2181 | GAOU7113252 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-04-30 | cerrado | embarcado | lleno | 1,330 |
| 2182 | GCXU6451663 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2183 | HASU4349996 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-30 | cerrado | embarcado | lleno | 245 |
| 2184 | HASU4671718 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-04-13 | cerrado | embarcado | lleno | 735 |
| 2185 | MRKU2351060 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-17 | cerrado | embarcado | lleno | 0 |
| 2186 | MRKU6060119 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-13 | cerrado | embarcado | lleno | 0 |
| 2187 | MRSU4354061 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-04-13 | cerrado | embarcado | lleno | 735 |
| 2188 | MRSU6697476 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-10 | 2026-03-30 | cerrado | embarcado | lleno | 245 |
| 2189 | MSKU0510859 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-17 | cerrado | embarcado | lleno | 0 |
| 2190 | MSKU1256780 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-04-13 | cerrado | embarcado | lleno | 735 |
| 2191 | SEKU6906017 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-03-17 | cerrado | embarcado | lleno | 0 |
| 2192 | TCKU7803129 | MAERSK | ABBOTT | DEFIBE | 2026-03-10 | 2026-03-18 | cerrado | embarcado | lleno | 0 |
| 2193 | TIIU4882977 | MAERSK | BAHIA | PTN | 2026-03-10 | 2026-04-13 | cerrado | embarcado | lleno | 735 |
| 2194 | BEAU6381431 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-03-23 | cerrado | embarcado | lleno | 0 |
| 2195 | CAAU6649969 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-03-30 | cerrado | embarcado | lleno | 210 |
| 2196 | MRKU3690217 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-04-09 | cerrado | embarcado | lleno | 560 |
| 2197 | MRKU3720836 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-04-08 | cerrado | embarcado | lleno | 525 |
| 2198 | MRSU3438131 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-09 | cerrado | embarcado | lleno | 560 |
| 2199 | MRSU3911033 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-21 | cerrado | embarcado | lleno | 980 |
| 2200 | MRSU4846396 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-05-08 | cerrado | embarcado | lleno | 1,575 |
| 2201 | MRSU7002470 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-14 | cerrado | embarcado | lleno | 735 |
| 2202 | MRSU7632762 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2203 | MSKU9686474 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-21 | cerrado | embarcado | lleno | 980 |
| 2204 | MVIU0033252 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2205 | SUDU6740132 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-08 | cerrado | embarcado | lleno | 525 |
| 2206 | SUDU8747774 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-05-08 | cerrado | embarcado | lleno | 1,575 |
| 2207 | TCKU7680678 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-04-09 | cerrado | embarcado | lleno | 560 |
| 2208 | TGBU5380892 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-09 | cerrado | embarcado | lleno | 560 |
| 2209 | TLLU5043608 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-11 | 2026-04-08 | cerrado | embarcado | lleno | 525 |
| 2210 | UETU6837260 | MAERSK | BAHIA | DEFIBE | 2026-03-11 | 2026-05-28 | cerrado | embarcado | lleno | 2,275 |
| 2211 | FFAU7411808 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-04-06 | cerrado | embarcado | lleno | 420 |
| 2212 | GAOU7118399 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2213 | GAOU7654920 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-05-08 | cerrado | embarcado | lleno | 1,540 |
| 2214 | MRKU3793426 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2215 | MRKU4517567 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-04-09 | cerrado | embarcado | lleno | 525 |
| 2216 | MRKU4572944 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-04-08 | cerrado | embarcado | lleno | 490 |
| 2217 | MRKU5362562 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-04-08 | cerrado | embarcado | lleno | 490 |
| 2218 | MRKU6457066 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-06-09 | cerrado | embarcado | lleno | 2,660 |
| 2219 | MRSU5137950 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-04-06 | cerrado | embarcado | lleno | 420 |
| 2220 | MRSU5185752 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-03-31 | cerrado | embarcado | lleno | 210 |
| 2221 | MRSU6157858 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-04-08 | cerrado | embarcado | lleno | 490 |
| 2222 | MRSU9007722 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-05-08 | cerrado | embarcado | lleno | 1,540 |
| 2223 | MRSU9319084 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-05-08 | cerrado | embarcado | lleno | 1,540 |
| 2224 | TCKU6790520 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-04-06 | cerrado | embarcado | lleno | 420 |
| 2225 | TCKU6931953 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2226 | TIIU4892506 | MAERSK | BAHIA | DEFIBE | 2026-03-12 | 2026-03-16 | cerrado | embarcado | lleno | 0 |
| 2227 | TIIU5285127 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-04-06 | cerrado | embarcado | lleno | 420 |
| 2228 | TRHU4095488 | MAERSK | BAHIA | PTN | 2026-03-12 | 2026-04-08 | cerrado | embarcado | lleno | 490 |
| 2229 | BEAU5756087 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2230 | CAAU8252250 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2231 | CAJU5258668 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2232 | HASU4013759 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2233 | HASU4410041 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-03-30 | cerrado | embarcado | lleno | 140 |
| 2234 | HASU4882650 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-04-23 | cerrado | embarcado | lleno | 980 |
| 2235 | HASU4890207 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2236 | MRKU3161430 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-04-09 | cerrado | embarcado | lleno | 490 |
| 2237 | MRKU3286503 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-04-09 | cerrado | embarcado | lleno | 490 |
| 2238 | MRKU3761476 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-05-28 | cerrado | embarcado | lleno | 2,205 |
| 2239 | MRKU3770014 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-04-16 | cerrado | embarcado | lleno | 735 |
| 2240 | MRKU4825180 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-04-23 | cerrado | embarcado | lleno | 980 |
| 2241 | MRSU3231550 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-04-21 | cerrado | embarcado | lleno | 910 |
| 2242 | MRSU3267379 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-04-21 | cerrado | embarcado | lleno | 910 |
| 2243 | MRSU3270238 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2244 | MRSU3425561 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-04-23 | cerrado | embarcado | lleno | 980 |
| 2245 | MRSU3758691 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-03-30 | cerrado | embarcado | lleno | 140 |
| 2246 | MRSU5124675 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-05-28 | cerrado | embarcado | lleno | 2,205 |
| 2247 | MRSU8300910 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2248 | MSKU1683606 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-04-16 | cerrado | embarcado | lleno | 735 |
| 2249 | MSKU9504754 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2250 | MSKU9628502 | MAERSK | BAHIA | DEFIBE | 2026-03-13 | 2026-05-28 | cerrado | embarcado | lleno | 2,205 |
| 2251 | SEGU4111819 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2252 | TGBU9346622 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-04-06 | cerrado | embarcado | lleno | 385 |
| 2253 | TIIU5539643 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2254 | TRHU4982590 | MAERSK | BAHIA | PTN | 2026-03-13 | 2026-03-31 | cerrado | embarcado | lleno | 175 |
| 2255 | CAAU5408437 | MAERSK | BAHIA | DEFIBE | 2026-03-14 | 2026-04-23 | cerrado | embarcado | lleno | 945 |
| 2256 | CAAU7303219 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2257 | FFAU6109440 | MAERSK | BAHIA | DEFIBE | 2026-03-14 | 2026-04-16 | cerrado | embarcado | lleno | 700 |
| 2258 | MRKU3436054 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-04-07 | cerrado | embarcado | lleno | 385 |
| 2259 | MRKU4692662 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-04-14 | cerrado | embarcado | lleno | 630 |
| 2260 | MRKU5004363 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2261 | MRSU4771661 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2262 | MRSU5197250 | MAERSK | BAHIA | DEFIBE | 2026-03-14 | 2026-06-19 | cerrado | embarcado | lleno | 2,940 |
| 2263 | MRSU5460005 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2264 | MRSU6617866 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-04-13 | cerrado | embarcado | lleno | 595 |
| 2265 | MRSU6775584 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-04-10 | cerrado | embarcado | lleno | 490 |
| 2266 | MRSU7227100 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-04-16 | cerrado | embarcado | lleno | 700 |
| 2267 | MRSU7448740 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2268 | MRSU8323500 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2269 | MRSU8658416 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-04-07 | cerrado | embarcado | lleno | 385 |
| 2270 | MRSU8699020 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2271 | SUDU6796595 | MAERSK | BAHIA | HUXLEY | 2026-03-14 | 2026-03-31 | cerrado | embarcado | lleno | 140 |
| 2272 | SUDU6940491 | MAERSK | BAHIA | DEFIBE | 2026-03-14 | 2026-04-23 | cerrado | embarcado | lleno | 945 |
| 2273 | CAJU5243117 | MAERSK | ABBOTT | GAMMA MUJICA | 2026-03-16 | 2026-03-18 | cerrado | embarcado | lleno | 0 |
| 2274 | CIPU5118333 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-03-23 | cerrado | embarcado | lleno | 0 |
| 2275 | HASU4333855 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-04-09 | cerrado | embarcado | lleno | 385 |
| 2276 | HASU4835597 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-04-09 | cerrado | embarcado | lleno | 385 |
| 2277 | MRKU2332332 | MAERSK | ABBOTT | GAMMA MUJICA | 2026-03-16 | 2026-03-18 | cerrado | embarcado | lleno | 0 |
| 2278 | MRKU2486472 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-16 | cerrado | embarcado | lleno | 630 |
| 2279 | MRKU4816866 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-10 | cerrado | embarcado | lleno | 420 |
| 2280 | MRKU4868406 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-04-21 | cerrado | embarcado | lleno | 805 |
| 2281 | MRKU5334869 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-07 | cerrado | embarcado | lleno | 315 |
| 2282 | MRKU5469421 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2283 | MRKU6075274 | MAERSK | BAHIA | HUXLEY | 2026-03-16 | 2026-04-14 | cerrado | embarcado | lleno | 560 |
| 2284 | MRKU6265248 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-07 | cerrado | embarcado | lleno | 315 |
| 2285 | MRSU4437802 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-13 | cerrado | embarcado | lleno | 525 |
| 2286 | MRSU5432600 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-28 | cerrado | embarcado | lleno | 1,050 |
| 2287 | MRSU6930802 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-04-21 | cerrado | embarcado | lleno | 805 |
| 2288 | MRSU8050663 | MAERSK | ABBOTT | GAMMA MUJICA | 2026-03-16 | 2026-03-18 | cerrado | embarcado | lleno | 0 |
| 2289 | MRSU8952246 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-03-30 | cerrado | embarcado | lleno | 35 |
| 2290 | MSKU0114570 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-14 | cerrado | embarcado | lleno | 560 |
| 2291 | MSKU1933351 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-04-09 | cerrado | embarcado | lleno | 385 |
| 2292 | SELU4012844 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-30 | cerrado | embarcado | lleno | 1,120 |
| 2293 | TCKU6584469 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-03-31 | cerrado | embarcado | lleno | 70 |
| 2294 | TCKU7448390 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-04-13 | cerrado | embarcado | lleno | 525 |
| 2295 | TCKU7452873 | MAERSK | BAHIA | DEFIBE | 2026-03-16 | 2026-03-31 | cerrado | embarcado | lleno | 70 |
| 2296 | TLLU8250276 | MAERSK | BAHIA | PTN | 2026-03-16 | 2026-04-21 | cerrado | embarcado | lleno | 805 |
| 2297 | BEAU6366782 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-05-26 | cerrado | embarcado | lleno | 1,995 |
| 2298 | CAAU8567392 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2299 | CXDU2263136 | MAERSK | BAHIA | DEFIBE | 2026-03-17 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2300 | FSCU7215859 | HAPAG LLOYD | BAHIA | PTN | 2026-03-17 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2301 | HAMU3137012 | HAPAG LLOYD | BAHIA | PTN | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 25 |
| 2302 | HASU4833188 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2303 | HASU5022056 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-04-10 | cerrado | embarcado | lleno | 385 |
| 2304 | HLBU2118928 | HAPAG LLOYD | BAHIA | PTN | 2026-03-17 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2305 | MRKU2150580 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-04-21 | cerrado | embarcado | lleno | 770 |
| 2306 | MRKU2731060 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2307 | MRKU2779104 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2308 | MRKU3160114 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-04-13 | cerrado | embarcado | lleno | 490 |
| 2309 | MRKU4535025 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2310 | MRKU5339393 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-04-07 | cerrado | embarcado | lleno | 280 |
| 2311 | MRKU5758759 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2312 | MRSU3463854 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-04-10 | cerrado | embarcado | lleno | 385 |
| 2313 | MRSU4198441 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-06-09 | cerrado | embarcado | lleno | 2,485 |
| 2314 | MRSU4286938 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-04-09 | cerrado | embarcado | lleno | 350 |
| 2315 | MRSU5151813 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-04-07 | cerrado | embarcado | lleno | 280 |
| 2316 | MRSU5683082 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2317 | MRSU6043916 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-04-16 | cerrado | embarcado | lleno | 595 |
| 2318 | MRSU7931228 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2319 | MRSU8062134 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-04-07 | cerrado | embarcado | lleno | 280 |
| 2320 | MSKU1094490 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2321 | TRHU4397003 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2322 | TRHU5248107 | MAERSK | BAHIA | HUXLEY | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2323 | TXGU5263667 | MAERSK | BAHIA | PTN | 2026-03-17 | 2026-03-31 | cerrado | embarcado | lleno | 35 |
| 2324 | GAOU7193010 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-04-14 | cerrado | embarcado | lleno | 490 |
| 2325 | MRKU3624534 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2326 | MRKU4034846 | MAERSK | BAHIA | HUXLEY | 2026-03-18 | 2026-04-30 | cerrado | embarcado | lleno | 1,050 |
| 2327 | MRKU4322098 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-04-14 | cerrado | embarcado | lleno | 490 |
| 2328 | MRSU5540380 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2329 | MRSU6785026 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2330 | MRSU8593146 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-04-14 | cerrado | embarcado | lleno | 490 |
| 2331 | MRSU8932337 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-03-20 | cerrado | embarcado | lleno | 0 |
| 2332 | MSKU1738421 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-04-14 | cerrado | embarcado | lleno | 490 |
| 2333 | SEGU4182622 | MAERSK | BAHIA | DEFIBE | 2026-03-18 | 2026-04-14 | cerrado | embarcado | lleno | 490 |
| 2334 | CAAU6441240 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2335 | MRKU5912015 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-04-16 | cerrado | embarcado | lleno | 525 |
| 2336 | MRKU6323621 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-03-23 | cerrado | embarcado | lleno | 0 |
| 2337 | MRSU7139294 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2338 | SELU4034458 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-04-28 | cerrado | embarcado | lleno | 945 |
| 2339 | TCKU6627154 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2340 | TCKU7001680 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-03-30 | cerrado | embarcado | lleno | 0 |
| 2341 | TEMU6232837 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-04-28 | cerrado | embarcado | lleno | 945 |
| 2342 | TGBU5385889 | MAERSK | BAHIA | HUXLEY | 2026-03-19 | 2026-04-14 | cerrado | embarcado | lleno | 455 |
| 2343 | TGHU6906113 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-05-05 | cerrado | embarcado | lleno | 1,190 |
| 2344 | TRHU4057744 | MAERSK | BAHIA | DEFIBE | 2026-03-19 | 2026-04-07 | cerrado | embarcado | lleno | 210 |
| 2345 | UETU7272065 | MAERSK | BAHIA | HUXLEY | 2026-03-19 | 2026-03-30 | cerrado | embarcado | lleno | 0 |
| 2346 | CAAU6245041 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2347 | CAAU9127905 | MAERSK | BAHIA | DEFIBE | 2026-03-20 | 2026-04-07 | cerrado | embarcado | lleno | 175 |
| 2348 | FANU1501560 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2349 | FANU3758897 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2350 | FANU3770439 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2351 | GCXU5912890 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2352 | HAMU2136480 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2353 | HAMU2706069 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2354 | HAMU2772327 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2355 | HAMU3065680 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2356 | HAMU3673191 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2357 | HAMU5151339 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2358 | HLBU2667276 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2359 | HLBU2840782 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2360 | HLBU3272645 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2361 | HLXU8106731 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2362 | HLXU8367740 | HAPAG LLOYD | BAHIA | PTN | 2026-03-20 | 2026-03-26 | cerrado | embarcado | lleno | 0 |
| 2363 | MRKU2264834 | MAERSK | BAHIA | PTN | 2026-03-20 | 2026-04-14 | cerrado | embarcado | lleno | 420 |
| 2364 | MRSU4895209 | MAERSK | BAHIA | PTN | 2026-03-20 | 2026-04-14 | cerrado | embarcado | lleno | 420 |
| 2365 | MRSU8357449 | MAERSK | BAHIA | DEFIBE | 2026-03-20 | 2026-03-30 | cerrado | embarcado | lleno | 0 |
| 2366 | SUDU8949353 | MAERSK | BAHIA | HUXLEY | 2026-03-20 | 2026-04-24 | cerrado | embarcado | lleno | 770 |
| 2367 | TCNU1481502 | MAERSK | BAHIA | DEFIBE | 2026-03-20 | 2026-05-07 | cerrado | embarcado | lleno | 1,225 |
| 2368 | GAOU7084540 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-10 | cerrado | embarcado | lleno | 245 |
| 2369 | GAOU7188760 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-24 | cerrado | embarcado | lleno | 735 |
| 2370 | GCXU6376600 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2371 | MRKU5521284 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-28 | cerrado | embarcado | lleno | 875 |
| 2372 | MRSU6749559 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2373 | MRSU7007169 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-24 | cerrado | embarcado | lleno | 735 |
| 2374 | MRSU8777040 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-05-09 | cerrado | embarcado | lleno | 1,260 |
| 2375 | MRSU8896029 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2376 | MRSU8921271 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-05-05 | cerrado | embarcado | lleno | 1,120 |
| 2377 | MRSU8993538 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-24 | cerrado | embarcado | lleno | 735 |
| 2378 | MRSU9389374 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-05-09 | cerrado | embarcado | lleno | 1,260 |
| 2379 | SEKU4444162 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-05-05 | cerrado | embarcado | lleno | 1,120 |
| 2380 | SUDU8920616 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-13 | cerrado | embarcado | lleno | 350 |
| 2381 | TIIU4593906 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-04-28 | cerrado | embarcado | lleno | 875 |
| 2382 | UETU8450264 | MAERSK | BAHIA | DEFIBE | 2026-03-21 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2383 | BSIU8053051 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2384 | BSIU8083082 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-07 | cerrado | embarcado | lleno | 70 |
| 2385 | CAAU6040972 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-07 | cerrado | embarcado | lleno | 70 |
| 2386 | CAAU8877675 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-07 | cerrado | embarcado | lleno | 70 |
| 2387 | CAJU5106449 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-08 | cerrado | embarcado | lleno | 105 |
| 2388 | FSCU8318548 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-14 | cerrado | embarcado | lleno | 315 |
| 2389 | HASU4560313 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-08 | cerrado | embarcado | lleno | 105 |
| 2390 | MIEU0040460 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-08 | cerrado | embarcado | lleno | 105 |
| 2391 | MRKU2808671 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-14 | cerrado | embarcado | lleno | 315 |
| 2392 | MRKU4776927 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-03-25 | cerrado | embarcado | lleno | 0 |
| 2393 | MRKU6260333 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2394 | MRSU4177449 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-14 | cerrado | embarcado | lleno | 315 |
| 2395 | MRSU4728290 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-28 | cerrado | embarcado | lleno | 805 |
| 2396 | MRSU4845023 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-16 | cerrado | embarcado | lleno | 385 |
| 2397 | MRSU7996717 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-14 | cerrado | embarcado | lleno | 315 |
| 2398 | MRSU8075300 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2399 | MSKU0943226 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-28 | cerrado | embarcado | lleno | 805 |
| 2400 | TCKU7383129 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-08 | cerrado | embarcado | lleno | 105 |
| 2401 | TCKU7992531 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2402 | TCNU1728207 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-08 | cerrado | embarcado | lleno | 105 |
| 2403 | TCNU2380395 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-07 | cerrado | embarcado | lleno | 70 |
| 2404 | TCNU3326594 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-24 | cerrado | embarcado | lleno | 665 |
| 2405 | TGBU6800027 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-13 | cerrado | embarcado | lleno | 280 |
| 2406 | UETU8448312 | MAERSK | BAHIA | PTN | 2026-03-23 | 2026-04-07 | cerrado | embarcado | lleno | 70 |
| 2407 | CAAU8635774 | MAERSK | BAHIA | PTN | 2026-03-25 | 2026-04-10 | cerrado | embarcado | lleno | 105 |
| 2408 | CAJU5277328 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-04-10 | cerrado | embarcado | lleno | 105 |
| 2409 | GCXU6311126 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-04-30 | cerrado | embarcado | lleno | 805 |
| 2410 | HASU4016700 | MAERSK | BAHIA | PTN | 2026-03-25 | 2026-04-10 | cerrado | embarcado | lleno | 105 |
| 2411 | HASU4501856 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-03-31 | cerrado | embarcado | lleno | 0 |
| 2412 | MRKU3410229 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-05-12 | cerrado | embarcado | lleno | 1,225 |
| 2413 | MRSU6805647 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2414 | MRSU8903909 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-05-26 | cerrado | embarcado | lleno | 1,715 |
| 2415 | MSKU9490244 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-04-10 | cerrado | embarcado | lleno | 105 |
| 2416 | SUDU8999122 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-05-19 | cerrado | embarcado | lleno | 1,470 |
| 2417 | TCLU5632404 | MAERSK | BAHIA | PTN | 2026-03-25 | 2026-04-10 | cerrado | embarcado | lleno | 105 |
| 2418 | TCLU8931477 | MAERSK | BAHIA | DEFIBE | 2026-03-25 | 2026-04-28 | cerrado | embarcado | lleno | 735 |
| 2419 | TLLU5886860 | MAERSK | BAHIA | HUXLEY | 2026-03-25 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2420 | UETU7327152 | MAERSK | BAHIA | PTN | 2026-03-25 | 2026-04-10 | cerrado | embarcado | lleno | 105 |
| 2421 | CAAU7158358 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-04-29 | cerrado | embarcado | lleno | 735 |
| 2422 | CAAU7581971 | MAERSK | BAHIA | PTN | 2026-03-26 | 2026-04-10 | cerrado | embarcado | lleno | 70 |
| 2423 | CAAU8319502 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-05-29 | cerrado | embarcado | lleno | 1,785 |
| 2424 | HASU4530411 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-04-28 | cerrado | embarcado | lleno | 700 |
| 2425 | MIEU0025580 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2426 | MRKU3042446 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-04-28 | cerrado | embarcado | lleno | 700 |
| 2427 | MRKU5783828 | MAERSK | BAHIA | PTN | 2026-03-26 | 2026-04-10 | cerrado | embarcado | lleno | 70 |
| 2428 | MRSU4525755 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2429 | MRSU9454530 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-04-24 | cerrado | embarcado | lleno | 560 |
| 2430 | SUDU8544720 | MAERSK | BAHIA | DEFIBE | 2026-03-26 | 2026-05-12 | cerrado | embarcado | lleno | 1,190 |
| 2431 | TIIU5340420 | MAERSK | BAHIA | PTN | 2026-03-26 | 2026-04-10 | cerrado | embarcado | lleno | 70 |
| 2432 | CAAU5292795 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-07 | cerrado | embarcado | lleno | 980 |
| 2433 | CAAU9526588 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-04-28 | cerrado | embarcado | lleno | 665 |
| 2434 | FFAU7101253 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-05-22 | cerrado | embarcado | lleno | 1,505 |
| 2435 | GAOU7203870 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-15 | cerrado | embarcado | lleno | 1,260 |
| 2436 | GCXU5565213 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-07 | cerrado | embarcado | lleno | 980 |
| 2437 | HASU5082100 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-28 | cerrado | embarcado | lleno | 1,715 |
| 2438 | MRKU3100162 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-22 | cerrado | embarcado | lleno | 1,505 |
| 2439 | MRSU4049920 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-28 | cerrado | embarcado | lleno | 1,715 |
| 2440 | MRSU4351479 | MAERSK | BAHIA | GAMMA | 2026-03-27 | 2026-06-09 | cerrado | embarcado | lleno | 2,135 |
| 2441 | MRSU6922535 | MAERSK | BAHIA | HUXLEY | 2026-03-27 | 2026-04-30 | cerrado | embarcado | lleno | 735 |
| 2442 | MRSU7446557 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2443 | MRSU8507451 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-05-07 | cerrado | embarcado | lleno | 980 |
| 2444 | MRSU9286057 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-04-16 | cerrado | embarcado | lleno | 245 |
| 2445 | MRSU9448121 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-05-07 | cerrado | embarcado | lleno | 980 |
| 2446 | SEKU6716125 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-05-07 | cerrado | embarcado | lleno | 980 |
| 2447 | TCLU5971537 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-05-22 | cerrado | embarcado | lleno | 1,505 |
| 2448 | TGHU9725989 | MAERSK | BAHIA | PTN | 2026-03-27 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2449 | TRHU4382600 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-04-16 | cerrado | embarcado | lleno | 245 |
| 2450 | UETU8513038 | MAERSK | BAHIA | DEFIBE | 2026-03-27 | 2026-05-09 | cerrado | embarcado | lleno | 1,050 |
| 2451 | CAAU8946077 | MAERSK | BAHIA | GAMMA | 2026-03-28 | 2026-04-30 | cerrado | embarcado | lleno | 700 |
| 2452 | CAAU8986613 | MAERSK | BAHIA | DEFIBE | 2026-03-28 | 2026-04-30 | cerrado | embarcado | lleno | 700 |
| 2453 | GESU6422899 | MAERSK | BAHIA | DEFIBE | 2026-03-28 | 2026-05-07 | cerrado | embarcado | lleno | 945 |
| 2454 | MRKU5443237 | MAERSK | BAHIA | DEFIBE | 2026-03-28 | 2026-04-28 | cerrado | embarcado | lleno | 630 |
| 2455 | MRSU9250157 | MAERSK | BAHIA | DEFIBE | 2026-03-28 | 2026-05-07 | cerrado | embarcado | lleno | 945 |
| 2456 | MRSU9414965 | MAERSK | BAHIA | GAMMA | 2026-03-28 | 2026-04-28 | cerrado | embarcado | lleno | 630 |
| 2457 | MSKU1934580 | MAERSK | BAHIA | DEFIBE | 2026-03-28 | 2026-04-28 | cerrado | embarcado | lleno | 630 |
| 2458 | MTSU9626490 | MAERSK | BAHIA | GAMMA | 2026-03-28 | 2026-06-19 | cerrado | embarcado | lleno | 2,450 |
| 2459 | BEAU5680340 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-06-25 | cerrado | embarcado | lleno | 2,590 |
| 2460 | MRKU2516319 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-04-28 | cerrado | embarcado | lleno | 560 |
| 2461 | MRKU3884906 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-04-28 | cerrado | embarcado | lleno | 560 |
| 2462 | MRKU6225081 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-04-16 | cerrado | embarcado | lleno | 140 |
| 2463 | MRSU4470610 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-04-28 | cerrado | embarcado | lleno | 560 |
| 2464 | MRSU6034827 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2465 | MRSU9315319 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-06-19 | cerrado | embarcado | lleno | 2,380 |
| 2466 | MSKU0039651 | MAERSK | BAHIA | PTN | 2026-03-30 | 2026-04-07 | cerrado | embarcado | lleno | 0 |
| 2467 | TCLU9852095 | MAERSK | BAHIA | DEFIBE | 2026-03-30 | 2026-06-16 | cerrado | embarcado | lleno | 2,275 |
| 2468 | TCNU8619759 | MAERSK | BAHIA | PTN | 2026-03-30 | 2026-04-28 | cerrado | embarcado | lleno | 560 |
| 2469 | TRHU4536691 | MAERSK | BAHIA | PTN | 2026-03-30 | 2026-04-28 | cerrado | embarcado | lleno | 560 |
| 2470 | CAAU7225034 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-07-06 | cerrado | embarcado | lleno | 2,940 |
| 2471 | CAAU8473230 | MAERSK | BAHIA | HUXLEY | 2026-03-31 | 2026-05-22 | cerrado | embarcado | lleno | 1,365 |
| 2472 | CAAU9139470 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-09 | cerrado | embarcado | lleno | 910 |
| 2473 | FFAU4768690 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-12 | cerrado | embarcado | lleno | 2,100 |
| 2474 | FFAU5008033 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2475 | FFAU5636847 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-07-06 | cerrado | embarcado | lleno | 2,940 |
| 2476 | FFAU5748744 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-14 | cerrado | embarcado | lleno | 1,085 |
| 2477 | GAOU7273857 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-19 | cerrado | embarcado | lleno | 2,345 |
| 2478 | GAOU7776804 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-29 | cerrado | embarcado | lleno | 560 |
| 2479 | GCXU6202906 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-07 | cerrado | embarcado | lleno | 840 |
| 2480 | HASU4283728 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-16 | cerrado | embarcado | lleno | 105 |
| 2481 | HASU4875096 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-26 | cerrado | embarcado | lleno | 1,505 |
| 2482 | HASU4971253 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2483 | MRKU2102999 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-12 | cerrado | embarcado | lleno | 1,015 |
| 2484 | MRKU2401270 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-12 | cerrado | embarcado | lleno | 1,015 |
| 2485 | MRKU2845206 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-04-24 | cerrado | embarcado | lleno | 385 |
| 2486 | MRKU3818632 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2487 | MRKU4144313 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2488 | MRKU4493803 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-05-12 | cerrado | embarcado | lleno | 1,015 |
| 2489 | MRKU4634537 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-05-15 | cerrado | embarcado | lleno | 1,120 |
| 2490 | MRKU4731820 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-12 | cerrado | embarcado | lleno | 2,100 |
| 2491 | MRKU5464409 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-06-19 | cerrado | embarcado | lleno | 2,345 |
| 2492 | MRKU5832563 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-16 | cerrado | embarcado | lleno | 2,240 |
| 2493 | MRKU6025247 | MAERSK | BAHIA | HUXLEY | 2026-03-31 | 2026-05-15 | cerrado | embarcado | lleno | 1,120 |
| 2494 | MRKU6187994 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2495 | MRKU6221738 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2496 | MRSU3077147 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-23 | cerrado | embarcado | lleno | 2,485 |
| 2497 | MRSU3100777 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-02 | cerrado | embarcado | lleno | 1,750 |
| 2498 | MRSU3229086 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-14 | cerrado | embarcado | lleno | 1,085 |
| 2499 | MRSU3541319 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-16 | cerrado | embarcado | lleno | 2,240 |
| 2500 | MRSU3993710 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2501 | MRSU4026925 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-09 | cerrado | embarcado | lleno | 910 |
| 2502 | MRSU4101778 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2503 | MRSU4231621 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-05 | cerrado | embarcado | lleno | 770 |
| 2504 | MRSU4545068 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2505 | MRSU5246349 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-09 | cerrado | embarcado | lleno | 910 |
| 2506 | MRSU5833794 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-14 | cerrado | embarcado | lleno | 1,085 |
| 2507 | MRSU6484742 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-07 | cerrado | embarcado | lleno | 840 |
| 2508 | MRSU6771927 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-15 | cerrado | embarcado | lleno | 1,120 |
| 2509 | MRSU7382982 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2510 | MRSU7545035 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-05 | cerrado | embarcado | lleno | 1,855 |
| 2511 | MRSU8265471 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2512 | MRSU8337870 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-05-12 | cerrado | embarcado | lleno | 1,015 |
| 2513 | MRSU8354619 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-05 | cerrado | embarcado | lleno | 770 |
| 2514 | MRSU8409500 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-27 | cerrado | embarcado | lleno | 1,540 |
| 2515 | MSKU0796362 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-05-09 | cerrado | embarcado | lleno | 910 |
| 2516 | MSKU0992597 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-05-12 | cerrado | embarcado | lleno | 1,015 |
| 2517 | MSKU1832490 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2518 | MSKU1934342 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-24 | cerrado | embarcado | lleno | 385 |
| 2519 | MSKU9431663 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-24 | cerrado | embarcado | lleno | 385 |
| 2520 | SEGU4242510 | MAERSK | BAHIA | HUXLEY | 2026-03-31 | 2026-05-29 | cerrado | embarcado | lleno | 1,610 |
| 2521 | SEKU4716276 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-06-05 | cerrado | embarcado | lleno | 1,855 |
| 2522 | SEKU6987641 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-28 | cerrado | embarcado | lleno | 525 |
| 2523 | SUDU6965606 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-28 | cerrado | embarcado | lleno | 1,575 |
| 2524 | SUDU8741478 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2525 | TCKU7259041 | MAERSK | BAHIA | DEFIBE | 2026-03-31 | 2026-06-09 | cerrado | embarcado | lleno | 1,995 |
| 2526 | TCNU1843432 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-05-14 | cerrado | embarcado | lleno | 1,085 |
| 2527 | TGBU9358140 | MAERSK | BAHIA | TERMINAL 4 | 2026-03-31 | 2026-04-30 | cerrado | embarcado | lleno | 595 |
| 2528 | CAAU7604085 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-04-28 | cerrado | embarcado | lleno | 490 |
| 2529 | CAAU9304195 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-04-30 | cerrado | embarcado | lleno | 560 |
| 2530 | MRKU3203324 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-05-28 | cerrado | embarcado | lleno | 1,540 |
| 2531 | MRKU5048084 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-04-30 | cerrado | embarcado | lleno | 560 |
| 2532 | MRKU5356636 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-05-05 | cerrado | embarcado | lleno | 735 |
| 2533 | MRKU6329281 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-04-30 | cerrado | embarcado | lleno | 560 |
| 2534 | MRSU7418555 | MAERSK | BAHIA | GAMMA | 2026-04-01 | 2026-06-05 | cerrado | embarcado | lleno | 1,820 |
| 2535 | MRSU8905970 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-05-12 | cerrado | embarcado | lleno | 980 |
| 2536 | MSKU1248595 | MAERSK | BAHIA | DEFIBE | 2026-04-01 | 2026-05-09 | cerrado | embarcado | lleno | 875 |
| 2537 | TCNU2498201 | MAERSK | BAHIA | GAMMA | 2026-04-01 | 2026-06-26 | cerrado | embarcado | lleno | 2,555 |
| 2538 | TLLU6916023 | MAERSK | BAHIA | HUXLEY | 2026-04-01 | 2026-04-30 | cerrado | embarcado | lleno | 560 |
| 2539 | FFAU5503504 | MAERSK | BAHIA | HUXLEY | 2026-04-07 | 2026-04-28 | cerrado | embarcado | lleno | 280 |
| 2540 | MRKU3387788 | MAERSK | BAHIA | HUXLEY | 2026-04-07 | 2026-04-29 | cerrado | embarcado | lleno | 315 |
| 2541 | TRHU4308412 | MAERSK | BAHIA | HUXLEY | 2026-04-07 | 2026-06-23 | cerrado | embarcado | lleno | 2,240 |
| 2542 | MSKU1298472 | MAERSK | ABBOTT | HUXLEY | 2026-04-09 | 2026-05-06 | cerrado | embarcado | lleno | 490 |
| 2543 | TCNU3543060 | MAERSK | ABBOTT | HUXLEY | 2026-04-09 | 2026-04-30 | cerrado | embarcado | lleno | 280 |
| 2544 | CAAU8596277 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-04-18 | cerrado | embarcado | lleno | 0 |
| 2545 | MRKU3215900 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-13 | cerrado | embarcado | lleno | 700 |
| 2546 | MRKU3782186 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-06-19 | cerrado | embarcado | lleno | 1,995 |
| 2547 | MRKU4620370 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-06-19 | cerrado | embarcado | lleno | 1,995 |
| 2548 | MRKU5348775 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-09 | cerrado | embarcado | lleno | 560 |
| 2549 | MRKU5814148 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-06-09 | cerrado | embarcado | lleno | 1,645 |
| 2550 | MRSU3611416 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-07 | cerrado | embarcado | lleno | 490 |
| 2551 | MRSU5034355 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-26 | cerrado | embarcado | lleno | 1,155 |
| 2552 | MSKU0808550 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-14 | cerrado | embarcado | lleno | 735 |
| 2553 | MTSU9612964 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-14 | cerrado | embarcado | lleno | 735 |
| 2554 | SUDU8802418 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-04-30 | cerrado | embarcado | lleno | 245 |
| 2555 | TLLU4890470 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-05-20 | cerrado | embarcado | lleno | 945 |
| 2556 | TLLU7596290 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-10 | 2026-06-19 | cerrado | embarcado | lleno | 1,995 |
| 2557 | BEAU6349722 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-05-26 | cerrado | embarcado | lleno | 1,015 |
| 2558 | BEAU6384662 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-05-14 | cerrado | embarcado | lleno | 595 |
| 2559 | CAAU5942653 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-18 | cerrado | embarcado | lleno | 0 |
| 2560 | CAAU8136435 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-18 | cerrado | embarcado | lleno | 0 |
| 2561 | CAAU8937373 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-05-13 | cerrado | embarcado | lleno | 560 |
| 2562 | GCXU6318476 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-06-19 | cerrado | embarcado | lleno | 1,855 |
| 2563 | MIEU3032155 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-21 | cerrado | embarcado | lleno | 0 |
| 2564 | MRKU2480495 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-06-19 | cerrado | embarcado | lleno | 1,855 |
| 2565 | MRKU2528686 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-21 | cerrado | embarcado | lleno | 0 |
| 2566 | MRKU5456888 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-06-24 | cerrado | embarcado | lleno | 2,030 |
| 2567 | MRSU3031362 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-06-19 | cerrado | embarcado | lleno | 1,855 |
| 2568 | MRSU3679611 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-06-09 | cerrado | embarcado | lleno | 1,505 |
| 2569 | MRSU5885967 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-16 | cerrado | embarcado | lleno | 0 |
| 2570 | MRSU6494376 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-21 | cerrado | embarcado | lleno | 0 |
| 2571 | PONU8260355 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-05-13 | cerrado | embarcado | lleno | 560 |
| 2572 | TCKU7748192 | MAERSK | BAHIA | PTN | 2026-04-14 | 2026-04-18 | cerrado | embarcado | lleno | 0 |
| 2573 | CAAU8455880 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-09 | cerrado | embarcado | lleno | 350 |
| 2574 | GAOU7135185 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-13 | cerrado | embarcado | lleno | 490 |
| 2575 | GESU6280562 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-07 | cerrado | embarcado | lleno | 280 |
| 2576 | HASU4138925 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-13 | cerrado | embarcado | lleno | 490 |
| 2577 | MRKU2226670 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-05 | cerrado | embarcado | lleno | 210 |
| 2578 | MRKU3800314 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-07 | cerrado | embarcado | lleno | 280 |
| 2579 | MRKU5634064 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-06-19 | cerrado | embarcado | lleno | 1,785 |
| 2580 | MRSU3870994 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-06-25 | cerrado | embarcado | lleno | 1,995 |
| 2581 | MRSU4783786 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-05 | cerrado | embarcado | lleno | 210 |
| 2582 | MRSU5658578 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-05-13 | cerrado | embarcado | lleno | 490 |
| 2583 | MSKU1999528 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-06-25 | cerrado | embarcado | lleno | 1,995 |
| 2584 | SUDU6795109 | MAERSK | BAHIA | PTN | 2026-04-16 | 2026-06-25 | cerrado | embarcado | lleno | 1,995 |
| 2585 | CAIU8482929 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2586 | FANU3208890 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2587 | FANU3454087 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2588 | HAMU3220868 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2589 | HAMU4039073 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2590 | HAMU4476216 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2591 | HLXU8182834 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2592 | HLXU8462455 | HAPAG LLOYD | BAHIA | PTN | 2026-04-17 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2593 | BSIU8084387 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-04-30 | cerrado | embarcado | lleno | 0 |
| 2594 | CAJU5051388 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-05 | cerrado | embarcado | lleno | 35 |
| 2595 | MRKU3411061 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-12 | cerrado | embarcado | lleno | 280 |
| 2596 | MRKU4126536 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-05 | cerrado | embarcado | lleno | 35 |
| 2597 | MRSU4639871 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-09 | cerrado | embarcado | lleno | 175 |
| 2598 | MRSU9381291 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-05 | cerrado | embarcado | lleno | 35 |
| 2599 | MSKU0556947 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-05 | cerrado | embarcado | lleno | 35 |
| 2600 | TCKU7385292 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-05 | cerrado | embarcado | lleno | 35 |
| 2601 | TEMU7762960 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-04-30 | cerrado | embarcado | lleno | 0 |
| 2602 | TGBU6689572 | MAERSK | BAHIA | TERMINAL 4 | 2026-04-21 | 2026-05-09 | cerrado | embarcado | lleno | 175 |
| 2603 | CAIU4301370 | HAPAG LLOYD | BAHIA | PTN | 2026-04-23 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2604 | MRKU3695008 | MAERSK | BAHIA | PTN | 2026-04-23 | 2026-04-24 | cerrado | embarcado | lleno | 0 |
| 2605 | MRSU4932093 | MAERSK | BAHIA | PTN | 2026-04-23 | 2026-04-24 | cerrado | embarcado | lleno | 0 |
| 2606 | TLLU5267167 | HAPAG LLOYD | BAHIA | PTN | 2026-04-23 | 2026-04-29 | cerrado | embarcado | lleno | 0 |
| 2607 | GAOU7145162 | MAERSK | BAHIA | PTN | 2026-04-29 | 2026-05-12 | cerrado | embarcado | lleno | 0 |
| 2608 | GESU6860806 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-06 | 2026-05-28 | cerrado | embarcado | lleno | 315 |
| 2609 | HASU5072611 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-06 | 2026-05-28 | cerrado | embarcado | lleno | 315 |
| 2610 | MRSU8030991 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-06 | 2026-05-28 | cerrado | embarcado | lleno | 315 |
| 2611 | MRSU8735636 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-06 | 2026-05-26 | cerrado | embarcado | lleno | 245 |
| 2612 | MRKU2781586 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-08 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2613 | MRSU9224538 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-08 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2614 | BEAU5106728 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2615 | GAOU7134764 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2616 | GCXU5769731 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-06-02 | cerrado | embarcado | lleno | 280 |
| 2617 | GCXU6501091 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-28 | cerrado | embarcado | lleno | 105 |
| 2618 | HASU4050407 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-06-02 | cerrado | embarcado | lleno | 280 |
| 2619 | MRKU2304921 | MAERSK | BAHIA | PTN | 2026-05-12 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2620 | MRKU2534483 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2621 | MRKU3130228 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-28 | cerrado | embarcado | lleno | 105 |
| 2622 | MRKU5506490 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-28 | cerrado | embarcado | lleno | 105 |
| 2623 | MRSU3260543 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-06-02 | cerrado | embarcado | lleno | 280 |
| 2624 | MRSU3555539 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-28 | cerrado | embarcado | lleno | 105 |
| 2625 | MRSU5985652 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2626 | MRSU6379156 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2627 | MRSU7316620 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2628 | MRSU7372881 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2629 | SUDU8915224 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2630 | UETU8161045 | MAERSK | BAHIA | PTN | 2026-05-12 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2631 | CAAU6877470 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-15 | cerrado | embarcado | lleno | 0 |
| 2632 | CAAU7940259 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-28 | cerrado | embarcado | lleno | 70 |
| 2633 | CAIU9422396 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2634 | FFAU5163071 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2635 | HASU4508953 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2636 | HASU4614847 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2637 | MIEU0044656 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2638 | MRKU4140318 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2639 | MRKU4190875 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-15 | cerrado | embarcado | lleno | 0 |
| 2640 | MRKU5613251 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2641 | MRKU6287988 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-06-02 | cerrado | embarcado | lleno | 245 |
| 2642 | MRSU3387461 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-06-05 | cerrado | embarcado | lleno | 350 |
| 2643 | MRSU3709315 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2644 | MRSU4471263 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2645 | MRSU8513372 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-15 | cerrado | embarcado | lleno | 0 |
| 2646 | MRSU8534570 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2647 | MRSU8716019 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2648 | MSKU1627752 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2649 | MSKU1630864 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-14 | cerrado | embarcado | lleno | 0 |
| 2650 | SUDU6991647 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-19 | cerrado | embarcado | lleno | 0 |
| 2651 | TCKU6787189 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-28 | cerrado | embarcado | lleno | 70 |
| 2652 | TCNU1930389 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-06-02 | cerrado | embarcado | lleno | 245 |
| 2653 | UETU6945120 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-28 | cerrado | embarcado | lleno | 70 |
| 2654 | UETU7288077 | MAERSK | BAHIA | PTN | 2026-05-13 | 2026-05-28 | cerrado | embarcado | lleno | 70 |
| 2655 | CAAU4708640 | MAERSK | BAHIA | PTN | 2026-05-14 | 2026-06-02 | cerrado | embarcado | lleno | 210 |
| 2656 | HASU4977164 | MAERSK | BAHIA | PTN | 2026-05-14 | 2026-06-02 | cerrado | embarcado | lleno | 210 |
| 2657 | HASU5187380 | MAERSK | BAHIA | PTN | 2026-05-14 | 2026-06-05 | cerrado | embarcado | lleno | 315 |
| 2658 | MRKU2004396 | MAERSK | ABBOTT | HUXLEY | 2026-05-14 | 2026-05-29 | cerrado | embarcado | lleno | 70 |
| 2659 | MRKU4616003 | MAERSK | BAHIA | PTN | 2026-05-14 | 2026-06-02 | cerrado | embarcado | lleno | 210 |
| 2660 | MRKU4623276 | MAERSK | BAHIA | HUXLEY | 2026-05-14 | 2026-05-28 | cerrado | embarcado | lleno | 35 |
| 2661 | MRKU6162656 | MAERSK | BAHIA | PTN | 2026-05-14 | 2026-06-02 | cerrado | embarcado | lleno | 210 |
| 2662 | HASU4398516 | MAERSK | BAHIA | PTN | 2026-05-15 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2663 | MRKU6357684 | MAERSK | BAHIA | PTN | 2026-05-15 | 2026-05-20 | cerrado | embarcado | lleno | 0 |
| 2664 | MRSU8140237 | MAERSK | BAHIA | PTN | 2026-05-15 | 2026-06-05 | cerrado | embarcado | lleno | 280 |
| 2665 | MSKU1601830 | MAERSK | BAHIA | PTN | 2026-05-15 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2666 | SEKU6891046 | MAERSK | BAHIA | PTN | 2026-05-15 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2667 | SUDU6746378 | MAERSK | BAHIA | PTN | 2026-05-15 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2668 | CAAU5227640 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2669 | CAAU6538754 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2670 | HASU4209382 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2671 | MRKU6294930 | MAERSK | BAHIA | HUXLEY | 2026-05-18 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2672 | MRSU3024070 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-06-05 | cerrado | embarcado | lleno | 175 |
| 2673 | MRSU6701792 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2674 | MRSU7687826 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-06-19 | cerrado | embarcado | lleno | 665 |
| 2675 | MSKU1637771 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2676 | TCLU1593146 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-18 | cerrado | embarcado | lleno | 0 |
| 2677 | TGBU9661603 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2678 | TIIU4730402 | MAERSK | BAHIA | PTN | 2026-05-18 | 2026-06-12 | cerrado | embarcado | lleno | 420 |
| 2679 | MRKU4138434 | MAERSK | BAHIA | HUXLEY | 2026-05-19 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2680 | SUDU8712232 | MAERSK | BAHIA | PTN | 2026-05-19 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2681 | TCKU6571950 | MAERSK | BAHIA | PTN | 2026-05-19 | 2026-06-10 | cerrado | embarcado | lleno | 315 |
| 2682 | CAAU6662575 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2683 | FFAU5375390 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2684 | GCXU6460536 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-06-10 | cerrado | embarcado | lleno | 245 |
| 2685 | MRKU4047416 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-06-10 | cerrado | embarcado | lleno | 245 |
| 2686 | MRKU6103099 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-06-03 | cerrado | embarcado | lleno | 0 |
| 2687 | MRSU4813089 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-06-10 | cerrado | embarcado | lleno | 245 |
| 2688 | MRSU7635416 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-06-03 | cerrado | embarcado | lleno | 0 |
| 2689 | TGHU6052230 | MAERSK | BAHIA | PTN | 2026-05-21 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2690 | CAAU9297075 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-06-09 | cerrado | embarcado | lleno | 175 |
| 2691 | MRKU2321024 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2692 | MRKU2531231 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2693 | MRKU2917672 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2694 | MRKU5899084 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2695 | MRSU3457023 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2696 | MRSU6291912 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2697 | MRSU7734363 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-06-19 | cerrado | embarcado | lleno | 525 |
| 2698 | SELU4061638 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2699 | SUDU5981069 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2700 | TCNU6589423 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-26 | cerrado | embarcado | lleno | 0 |
| 2701 | TGHU9690542 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2702 | TIIU4878160 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-06-03 | cerrado | embarcado | lleno | 0 |
| 2703 | TIIU5524751 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2704 | TLLU4701915 | MAERSK | BAHIA | PTN | 2026-05-22 | 2026-07-08 | cerrado | embarcado | lleno | 1,190 |
| 2705 | BSIU8577850 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2706 | CAAU7913470 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2707 | MRKU3952301 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-12 | cerrado | embarcado | lleno | 140 |
| 2708 | MRKU6009349 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2709 | MRSU3910037 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2710 | MRSU3980733 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2711 | MRSU7000890 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2712 | MSKU0609950 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2713 | MSKU9470799 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2714 | SUDU8507726 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-05-27 | cerrado | embarcado | lleno | 0 |
| 2715 | TCNU3526904 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2716 | UETU8198532 | MAERSK | BAHIA | PTN | 2026-05-26 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2717 | CAAU6654224 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2718 | CIPU5180279 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2719 | MRKU4499777 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2720 | MRKU5692203 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-29 | cerrado | embarcado | lleno | 700 |
| 2721 | MRSU3135304 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2722 | MRSU5317083 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2723 | MRSU6226028 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2724 | MRSU8138190 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2725 | MRSU8544748 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2726 | MRSU9515739 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2727 | MSKU0773562 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2728 | MSKU1630360 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2729 | TCKU7405104 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2730 | TGBU5362292 | MAERSK | BAHIA | PTN | 2026-05-27 | 2026-06-02 | cerrado | embarcado | lleno | 0 |
| 2731 | BEAU5186261 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-10 | cerrado | embarcado | lleno | 0 |
| 2732 | CAAU4693962 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2733 | CAJU5087077 | MAERSK | BAHIA | PTN | 2026-05-28 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2734 | MRKU3201980 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-12 | cerrado | embarcado | lleno | 70 |
| 2735 | MRKU4377681 | MAERSK | BAHIA | PTN | 2026-05-28 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2736 | MRKU5088024 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-19 | cerrado | embarcado | lleno | 315 |
| 2737 | MRKU6490505 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-25 | cerrado | embarcado | lleno | 525 |
| 2738 | MRSU3236850 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-19 | cerrado | embarcado | lleno | 315 |
| 2739 | MRSU7380594 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-19 | cerrado | embarcado | lleno | 315 |
| 2740 | MRSU8765970 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-19 | cerrado | embarcado | lleno | 315 |
| 2741 | MSKU9069322 | MAERSK | BAHIA | TERMINAL 4 | 2026-05-28 | 2026-06-19 | cerrado | embarcado | lleno | 315 |
| 2742 | SEKU6994316 | MAERSK | BAHIA | PTN | 2026-05-28 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2743 | TCKU7408192 | MAERSK | BAHIA | PTN | 2026-05-28 | 2026-05-28 | cerrado | embarcado | lleno | 0 |
| 2744 | BMOU4172000 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-07-17 | cerrado | devuelto_vacio | vacio | 1,085 |
| 2745 | CAAU8468553 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-27 | cerrado | embarcado | lleno | 385 |
| 2746 | FFAU7091849 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-23 | cerrado | embarcado | lleno | 245 |
| 2747 | HASU4869299 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-16 | cerrado | embarcado | lleno | 0 |
| 2748 | MAGU5210766 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-25 | cerrado | embarcado | lleno | 315 |
| 2749 | MRKU3414287 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-24 | cerrado | embarcado | lleno | 280 |
| 2750 | MRKU4399124 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-23 | cerrado | embarcado | lleno | 245 |
| 2751 | MRKU4889266 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-27 | cerrado | embarcado | lleno | 385 |
| 2752 | MRKU5771220 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2753 | MRKU5822020 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2754 | MRKU5875210 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-16 | cerrado | embarcado | lleno | 0 |
| 2755 | MRSU3247135 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2756 | MRSU4117347 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-23 | cerrado | embarcado | lleno | 245 |
| 2757 | MRSU6456416 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-24 | cerrado | embarcado | lleno | 280 |
| 2758 | MRSU6742852 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2759 | MRSU7102546 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-10 | cerrado | embarcado | lleno | 0 |
| 2760 | MRSU7138472 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-23 | cerrado | embarcado | lleno | 245 |
| 2761 | MRSU7545415 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-19 | cerrado | embarcado | lleno | 105 |
| 2762 | MRSU9422111 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-24 | cerrado | embarcado | lleno | 280 |
| 2763 | SUDU8506530 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2764 | SUDU8973236 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-23 | cerrado | embarcado | lleno | 245 |
| 2765 | TCKU6581114 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2766 | TCKU6590287 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2767 | TCKU7702864 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2768 | TCLU6264143 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-29 | cerrado | embarcado | lleno | 455 |
| 2769 | TRHU8052801 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-27 | cerrado | embarcado | lleno | 385 |
| 2770 | TRLU8199220 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-03 | 2026-06-27 | cerrado | embarcado | lleno | 385 |
| 2771 | BEAU4543873 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2772 | BSIU8296642 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2773 | FCIU7439248 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2774 | HAMU4974991 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2775 | HAMU4977199 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2776 | HAMU5053414 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2777 | HLBU2410225 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2778 | HLBU2481656 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2779 | SEGU5713831 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2780 | TCKU6023956 | HAPAG LLOYD | BAHIA | PTN | 2026-06-05 | 2026-06-09 | cerrado | embarcado | lleno | 0 |
| 2781 | GCXU5654500 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-30 | cerrado | embarcado | lleno | 385 |
| 2782 | HASU4360130 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-19 | cerrado | embarcado | lleno | 0 |
| 2783 | MAGU5131667 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-19 | cerrado | embarcado | lleno | 0 |
| 2784 | MRKU3937246 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-23 | cerrado | embarcado | lleno | 140 |
| 2785 | MRKU3970012 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-19 | cerrado | embarcado | lleno | 0 |
| 2786 | MRSU4740845 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-24 | cerrado | embarcado | lleno | 175 |
| 2787 | MRSU5343539 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-24 | cerrado | embarcado | lleno | 175 |
| 2788 | MRSU8745491 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-23 | cerrado | embarcado | lleno | 140 |
| 2789 | MSKU1947231 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-26 | cerrado | embarcado | lleno | 245 |
| 2790 | TCNU3005763 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-24 | cerrado | embarcado | lleno | 175 |
| 2791 | TCNU6487205 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-06 | 2026-06-24 | cerrado | embarcado | lleno | 175 |
| 2792 | CAAU7303369 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-10 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2793 | HASU4539281 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-10 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2794 | MRSU6895358 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-10 | 2026-06-27 | cerrado | embarcado | lleno | 140 |
| 2795 | MRSU7976270 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-10 | 2026-06-24 | cerrado | embarcado | lleno | 35 |
| 2796 | MRSU9219790 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-10 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2797 | TCKU6790393 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-10 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2798 | FANU3737636 | HAPAG LLOYD | BAHIA | PTN | 2026-06-12 | 2026-07-03 | cerrado | embarcado | lleno | 200 |
| 2799 | HAMU4577016 | HAPAG LLOYD | BAHIA | PTN | 2026-06-12 | 2026-06-29 | cerrado | embarcado | lleno | 100 |
| 2800 | HLBU2183013 | HAPAG LLOYD | BAHIA | PTN | 2026-06-12 | 2026-07-03 | cerrado | embarcado | lleno | 200 |
| 2801 | SEGU5011054 | HAPAG LLOYD | BAHIA | PTN | 2026-06-12 | 2026-07-03 | cerrado | embarcado | lleno | 200 |
| 2802 | HASU4667889 | MAERSK | ABBOTT | HUXLEY | 2026-06-16 | 2026-07-10 | cerrado | embarcado | lleno | 385 |
| 2803 | CAAU9052426 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-17 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2804 | MRSU5031905 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-17 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2805 | MRSU6165323 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-17 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2806 | MSKU9949420 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-17 | 2026-06-23 | cerrado | embarcado | lleno | 0 |
| 2807 | SUDU8971969 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-17 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2808 | BEAU4390389 | HAPAG LLOYD | BAHIA | PTN | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2809 | BEAU5210305 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2810 | FCIU7439757 | HAPAG LLOYD | BAHIA | PTN | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2811 | HAMU1462728 | HAPAG LLOYD | BAHIA | PTN | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2812 | HAMU1894399 | HAPAG LLOYD | BAHIA | PTN | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2813 | HASU5063100 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2814 | HLBU2033081 | HAPAG LLOYD | BAHIA | PTN | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2815 | MRKU4616066 | MAERSK | BAHIA | PTN | 2026-06-19 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2816 | MRKU6331313 | MAERSK | BAHIA | PTN | 2026-06-19 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2817 | MRSU3088115 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2818 | MRSU3116270 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2819 | MRSU6496234 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-07-03 | cerrado | embarcado | lleno | 35 |
| 2820 | MRSU7558243 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2821 | MRSU7820097 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2822 | MRSU8749666 | MAERSK | BAHIA | PTN | 2026-06-19 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2823 | TIIU4879850 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-19 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2824 | CAAU4732415 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2825 | CAAU9281952 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2826 | CAIU4718600 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2827 | MRKU6109224 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2828 | MRSU3344834 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2829 | MRSU6695914 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2830 | MRSU7163351 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2831 | MRSU8693320 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2832 | MRSU8847132 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2833 | MSKU1060524 | MAERSK | BAHIA | PTN | 2026-06-23 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2834 | CAAU7611910 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2835 | CAJU5173684 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2836 | FFAU5313973 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2837 | HASU4196623 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2838 | HASU4487742 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2839 | HASU5104513 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2840 | MRKU3068707 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2841 | MRKU3083070 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2842 | MRKU3899465 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2843 | MRKU4098115 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2844 | MRSU3793970 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2845 | MRSU4868245 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2846 | MRSU6013932 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2847 | MRSU8036897 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2848 | SUDU8998390 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2849 | TGBU8927432 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2850 | TRHU4243116 | MAERSK | BAHIA | PTN | 2026-06-24 | 2026-06-26 | cerrado | embarcado | lleno | 0 |
| 2851 | HASU5082008 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2852 | MRKU2199533 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2853 | MRKU2940841 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2854 | MRKU3221903 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2855 | MRKU4407390 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2856 | MRKU5386749 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2857 | MRKU5404837 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2858 | MRSU7458012 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2859 | SUDU8756380 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-25 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2860 | CAAU5780803 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2861 | CAAU9795674 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2862 | CIPU5222590 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2863 | FFAU5615762 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2864 | FFAU5758233 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2865 | FSCU8278907 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2866 | GESU5942807 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2867 | MAGU5132880 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2868 | MRKU2669663 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2869 | MRKU3522229 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2870 | MRKU3895834 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2871 | MRKU4339418 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2872 | MRKU4597958 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2873 | MRKU5740683 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2874 | MRSU3698530 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2875 | MRSU4069742 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2876 | MRSU6839950 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2877 | MRSU7651850 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2878 | MSKU1091762 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2879 | MSKU1522520 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2880 | SEKU4712970 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2881 | SJCU4518060 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | devuelto_vacio | vacio | 0 |
| 2882 | SUDU6685478 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2883 | TGHU6139177 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2884 | TGHU8481609 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2885 | TRHU7440079 | MAERSK | BAHIA | PTN | 2026-06-26 | 2026-06-29 | cerrado | embarcado | lleno | 0 |
| 2886 | CAAU6747311 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-13 | cerrado | embarcado | lleno | 105 |
| 2887 | FFAU5201090 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-13 | cerrado | embarcado | lleno | 105 |
| 2888 | FFAU7446255 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2889 | MRKU5543581 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-13 | cerrado | embarcado | lleno | 105 |
| 2890 | MRSU6157230 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-13 | cerrado | embarcado | lleno | 105 |
| 2891 | TCLU8443765 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2892 | TCNU1808241 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-27 | 2026-07-13 | cerrado | embarcado | lleno | 105 |
| 2893 | BEAU5212273 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2894 | CAAU6611644 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2895 | CAAU6726073 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2896 | CAAU8927605 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-16 | cerrado | embarcado | lleno | 105 |
| 2897 | CAIU7215888 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-07 | cerrado | embarcado | lleno | 0 |
| 2898 | FFAU2345302 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2899 | HAMU4084909 | HAPAG LLOYD | BAHIA | PTN | 2026-06-30 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2900 | HASU4367177 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-14 | cerrado | embarcado | lleno | 35 |
| 2901 | HASU4997875 | MAERSK | BAHIA | PTN | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2902 | MIEU3011065 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-14 | cerrado | embarcado | lleno | 35 |
| 2903 | MRKU3927124 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2904 | MRKU4251918 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2905 | MRKU5259132 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-16 | cerrado | embarcado | lleno | 105 |
| 2906 | MRKU5272284 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2907 | MRKU5908735 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2908 | MRKU6037696 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2909 | MRSU3585852 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2910 | MRSU3677250 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2911 | MRSU4257267 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-07 | cerrado | embarcado | lleno | 0 |
| 2912 | MRSU6517147 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2913 | MRSU6960432 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2914 | MRSU7686809 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2915 | MRSU7785400 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2916 | MSKU1170373 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2917 | SUDU6890615 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-06-30 | cerrado | embarcado | lleno | 0 |
| 2918 | TCKU6406472 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2919 | TCLU5463500 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2920 | TCNU2488857 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2921 | TCNU2834796 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-14 | cerrado | embarcado | lleno | 35 |
| 2922 | TCNU4471869 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-07 | cerrado | embarcado | lleno | 0 |
| 2923 | TCNU7555120 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2924 | TLLU5115061 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2925 | TLLU7513104 | MAERSK | BAHIA | TERMINAL 4 | 2026-06-30 | 2026-07-14 | cerrado | embarcado | lleno | 35 |
| 2926 | TRHU5663514 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-03 | cerrado | embarcado | lleno | 0 |
| 2927 | UETU7830779 | MAERSK | BAHIA | PTN | 2026-06-30 | 2026-07-06 | cerrado | embarcado | lleno | 0 |
| 2928 | HASU5091870 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-03 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2929 | MRSU9025388 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-03 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2930 | SUDU8896593 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-03 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2931 | TCNU4814063 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-03 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2932 | GAOU7122275 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2933 | GAOU7776255 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2934 | GCXU5811493 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2935 | MRSU3124953 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2936 | MRSU8451310 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2937 | MSKU1875975 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | 2026-07-14 | cerrado | embarcado | lleno | 0 |
| 2938 | TRHU7121913 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-04 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2939 | CAAU5693545 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2940 | CAJU5288678 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | 2026-07-14 | cerrado | embarcado | lleno | 0 |
| 2941 | GCXU6415141 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2942 | MRKU3439794 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2943 | MRSU5348968 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | 2026-07-16 | cerrado | embarcado | lleno | 0 |
| 2944 | MRSU6034663 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2945 | MRSU6606347 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | 2026-07-14 | cerrado | embarcado | lleno | 0 |
| 2946 | MRSU7721941 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2947 | SUDU8978860 | MAERSK | BAHIA | TERMINAL 4 | 2026-07-06 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2948 | CAAU6202501 | MAERSK | BAHIA | PTN | 2026-07-13 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2949 | MIEU2034087 | MAERSK | BAHIA | PTN | 2026-07-13 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2950 | MRKU3394703 | MAERSK | BAHIA | PTN | 2026-07-13 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2951 | MRSU4574106 | MAERSK | BAHIA | PTN | 2026-07-13 | 2026-07-14 | cerrado | embarcado | lleno | 0 |
| 2952 | MSKU9958361 | MAERSK | BAHIA | PTN | 2026-07-13 | 2026-07-14 | cerrado | embarcado | lleno | 0 |
| 2953 | SUDU6843613 | MAERSK | BAHIA | PTN | 2026-07-13 | 2026-07-14 | cerrado | embarcado | lleno | 0 |
| 2954 | TCKU7740859 | MAERSK | BAHIA | PTN | 2026-07-13 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2955 | CAAU8300214 | MAERSK | BAHIA | PTN | 2026-07-14 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2956 | MRKU4864252 | MAERSK | BAHIA | PTN | 2026-07-14 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2957 | MRSU5585743 | MAERSK | BAHIA | PTN | 2026-07-14 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2958 | MRSU6066233 | MAERSK | BAHIA | PTN | 2026-07-14 | — | en_transito_a_terminal | pendiente | lleno |  |
| 2959 | SEKU4466006 | MAERSK | BAHIA | PTN | 2026-07-14 | — | en_transito_a_terminal | pendiente | lleno |  |