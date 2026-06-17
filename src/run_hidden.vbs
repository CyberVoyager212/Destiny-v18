Dim args
Set args = WScript.Arguments

If args.Count < 1 Then
  WScript.Quit 1
End If

Dim ps1
ps1 = args(0)

Dim extra
extra = ""

Dim i
For i = 1 To args.Count - 1
  extra = extra & " " & args(i)
Next

Dim cmd
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & ps1 & """" & extra

CreateObject("WScript.Shell").Run cmd, 0, False
