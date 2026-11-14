' ==============================================================================
' Mesa de Compras IA - FSConsultoria Farmaceutica
' Launcher Silencioso para Area de Trabalho (Sem janela preta de console)
' ==============================================================================
Option Explicit

Dim WshShell, fso, strDir, nodeExe, serverMjs, logFile, http, i, isRunning, cmdLine

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir

' 1. Verifica se o servidor ja esta rodando na porta 3456
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.setTimeouts 600, 600, 600, 600
http.open "GET", "http://127.0.0.1:3456/api/license/status", False
http.send

If Err.Number = 0 And (http.status = 200 Or http.status = 403) Then
    ' Servidor ja esta em execucao! Apenas abre o navegador na tela principal
    WshShell.Run "http://127.0.0.1:3456"
    WScript.Quit 0
End If
On Error Goto 0

' 2. Prioriza runtime portatil em bin\node.exe
If fso.FileExists(strDir & "\bin\node.exe") Then
    nodeExe = strDir & "\bin\node.exe"
Else
    nodeExe = "node"
End If

serverMjs = strDir & "\src\server.mjs"
logFile = strDir & "\data\servidor_log.txt"

If Not fso.FolderExists(strDir & "\data") Then
    fso.CreateFolder(strDir & "\data")
End If

' 3. Dispara o servidor via cmd.exe de forma 100% oculta gravando log
cmdLine = "cmd.exe /c """"" & nodeExe & """ """ & serverMjs & """ > """ & logFile & """ 2>&1"""
WshShell.Run cmdLine, 0, False

' 4. Aguarda ativamente o servidor subir na porta 3456 (polling de ate 15 segundos)
isRunning = False
For i = 1 To 30
    WScript.Sleep 500
    On Error Resume Next
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 400, 400, 400, 400
    http.open "GET", "http://127.0.0.1:3456/api/license/status", False
    http.send
    If Err.Number = 0 And (http.status = 200 Or http.status = 403) Then
        isRunning = True
        Exit For
    End If
    On Error Goto 0
Next

' 5. Abre o navegador na Home Page
WshShell.Run "http://127.0.0.1:3456"
