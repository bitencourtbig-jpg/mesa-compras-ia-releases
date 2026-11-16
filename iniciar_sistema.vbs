' ==============================================================================
' Mesa de Compras IA - FSConsultoria Farmaceutica
' Launcher Silencioso para Area de Trabalho (100% Invisivel, sem janela preta)
' ==============================================================================
Option Explicit

Dim WshShell, fso, strDir, psScript, cmdLine

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir

psScript = strDir & "\scripts\iniciar_silencioso.ps1"

' Dispara o launcher PowerShell em modo totalmente oculto (WindowStyle Hidden + Run 0)
cmdLine = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & psScript & """"
WshShell.Run cmdLine, 0, False
