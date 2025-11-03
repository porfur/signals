let SessionLoad = 1
let s:so_save = &g:so | let s:siso_save = &g:siso | setg so=0 siso=0 | setl so=-1 siso=-1
let v:this_session=expand("<sfile>:p")
silent only
silent tabonly
cd ~/Documents/Dev/op/JS/signals
if expand('%') == '' && !&modified && line('$') <= 1 && getline(1) == ''
  let s:wipebuf = bufnr('%')
endif
let s:shortmess_save = &shortmess
if &shortmess =~ 'A'
  set shortmess=aoOA
else
  set shortmess=aoO
endif
badd +22 ~/Documents/Dev/op/JS/signals/index.js
badd +134 examples.js
argglobal
%argdel
edit ~/Documents/Dev/op/JS/signals/index.js
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd w
let &splitbelow = s:save_splitbelow
let &splitright = s:save_splitright
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
exe 'vert 1resize ' . ((&columns * 122 + 123) / 246)
exe 'vert 2resize ' . ((&columns * 123 + 123) / 246)
argglobal
balt examples.js
setlocal foldmethod=indent
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal nofoldenable
10
sil! normal! zo
17
sil! normal! zo
20
sil! normal! zo
22
sil! normal! zo
24
sil! normal! zo
38
sil! normal! zo
53
sil! normal! zo
57
sil! normal! zo
58
sil! normal! zo
74
sil! normal! zo
86
sil! normal! zo
95
sil! normal! zo
100
sil! normal! zo
102
sil! normal! zo
111
sil! normal! zo
112
sil! normal! zo
133
sil! normal! zo
140
sil! normal! zo
146
sil! normal! zo
147
sil! normal! zo
173
sil! normal! zo
187
sil! normal! zo
196
sil! normal! zo
197
sil! normal! zo
207
sil! normal! zo
208
sil! normal! zo
223
sil! normal! zo
239
sil! normal! zo
243
sil! normal! zo
246
sil! normal! zo
250
sil! normal! zo
271
sil! normal! zo
272
sil! normal! zo
273
sil! normal! zo
281
sil! normal! zo
282
sil! normal! zo
291
sil! normal! zo
292
sil! normal! zo
291
sil! normal! zo
292
sil! normal! zo
315
sil! normal! zo
320
sil! normal! zo
322
sil! normal! zo
328
sil! normal! zo
331
sil! normal! zo
333
sil! normal! zo
342
sil! normal! zo
349
sil! normal! zo
356
sil! normal! zo
357
sil! normal! zo
378
sil! normal! zo
379
sil! normal! zo
395
sil! normal! zo
401
sil! normal! zo
405
sil! normal! zo
413
sil! normal! zo
421
sil! normal! zo
431
sil! normal! zo
433
sil! normal! zo
443
sil! normal! zo
446
sil! normal! zo
447
sil! normal! zo
451
sil! normal! zo
453
sil! normal! zo
456
sil! normal! zo
458
sil! normal! zo
465
sil! normal! zo
467
sil! normal! zo
468
sil! normal! zo
474
sil! normal! zo
let s:l = 300 - ((29 * winheight(0) + 31) / 62)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 300
normal! 056|
wincmd w
argglobal
if bufexists(fnamemodify("examples.js", ":p")) | buffer examples.js | else | edit examples.js | endif
if &buftype ==# 'terminal'
  silent file examples.js
endif
balt ~/Documents/Dev/op/JS/signals/index.js
setlocal foldmethod=indent
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal nofoldenable
let s:l = 50 - ((49 * winheight(0) + 31) / 62)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 50
normal! 0
wincmd w
2wincmd w
exe 'vert 1resize ' . ((&columns * 122 + 123) / 246)
exe 'vert 2resize ' . ((&columns * 123 + 123) / 246)
tabnext 1
if exists('s:wipebuf') && len(win_findbuf(s:wipebuf)) == 0 && getbufvar(s:wipebuf, '&buftype') isnot# 'terminal'
  silent exe 'bwipe ' . s:wipebuf
endif
unlet! s:wipebuf
set winheight=1 winwidth=20
let &shortmess = s:shortmess_save
let &winminheight = s:save_winminheight
let &winminwidth = s:save_winminwidth
let s:sx = expand("<sfile>:p:r")."x.vim"
if filereadable(s:sx)
  exe "source " . fnameescape(s:sx)
endif
let &g:so = s:so_save | let &g:siso = s:siso_save
set hlsearch
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
